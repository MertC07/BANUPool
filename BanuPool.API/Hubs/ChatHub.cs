using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using BanuPool.Data;
using BanuPool.Core.Entities;
using System.Security.Claims;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using System;
using Microsoft.EntityFrameworkCore;

namespace BanuPool.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;
        
        // --- State Management ---
        // UserId -> Connection Count (Robust for multiple tabs)
        public static ConcurrentDictionary<string, int> UserConnectionCounts = new ConcurrentDictionary<string, int>();

        public ChatHub(AppDbContext context)
        {
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                            ?? Context.User?.FindFirst("UserId")?.Value;

                Console.WriteLine($"[SignalR] OnConnected: ConnectionId={Context.ConnectionId}, UserId={userId}"); 

                if (!string.IsNullOrEmpty(userId))
                {
                    // Increment count
                    int count = UserConnectionCounts.AddOrUpdate(userId, 1, (key, value) => value + 1);

                    await Groups.AddToGroupAsync(Context.ConnectionId, userId);

                    // Only update DB/Notify if this is the FIRST connection (User just came online)
                    if (count == 1)
                    {
                         // Update DB User Status to Online
                         // Note: We use a scope factory or careful context usage in production, 
                         // but here we rely on the injected scoped context for this hub invocation.
                        if (int.TryParse(userId, out int uid))
                        {
                            var user = await _context.Users.FindAsync(uid);
                            if (user != null)
                            {
                                user.IsOnline = true;
                                await _context.SaveChangesAsync();
                            }
                        }
                        
                        await Clients.All.SendAsync("UserStatusChanged", userId, true, DateTime.UtcNow);
                    }
                }
            }
            catch (Exception ex)
            {
                 Console.WriteLine($"[SignalR] OnConnected ERROR: {ex.Message}");
            }
            
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                            ?? Context.User?.FindFirst("UserId")?.Value;

                if (!string.IsNullOrEmpty(userId))
                {
                    // Decrement count
                    int count = UserConnectionCounts.AddOrUpdate(userId, 0, (key, value) => value > 0 ? value - 1 : 0);

                    // Only update DB/Notify if count reaches 0 (User is truly offline)
                    if (count == 0)
                    {
                        // Remove from tracking completely to keep dictionary clean
                        UserConnectionCounts.TryRemove(userId, out _);

                        if (int.TryParse(userId, out int uid))
                        {
                            var user = await _context.Users.FindAsync(uid);
                            if (user != null)
                            {
                                user.IsOnline = false;
                                user.LastActiveAt = DateTime.UtcNow;
                                await _context.SaveChangesAsync();
                            }
                        }

                        await Clients.All.SendAsync("UserStatusChanged", userId, false, DateTime.UtcNow);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SignalR] OnDisconnected ERROR: {ex.Message}");
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(string receiverIdStr, string content)
        {
            Console.WriteLine($"[SignalR] SendMessage Called: Receiver={receiverIdStr}, Content={content}"); 
            
            try 
            {
                if (string.IsNullOrWhiteSpace(content)) throw new HubException("Content empty.");

                // Re-implementing simplified validation to ensure context
                var senderIdStr = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? Context.User?.FindFirst("UserId")?.Value;
                 if (!int.TryParse(senderIdStr, out int senderId)) throw new HubException("Invalid Sender.");
                 if (!int.TryParse(receiverIdStr, out int receiverId)) throw new HubException("Invalid Receiver.");

                // Validate Sender
                // Check if sender actually exists in DB (to prevent FK error if user deleted but token valid)
                var senderExists = await _context.Users.AnyAsync(u => u.Id == senderId);
                if (!senderExists)
                {
                     Console.WriteLine($"[SignalR] Error: Sender User {senderId} not found in DB.");
                     throw new HubException("Unauthorized: User not found.");
                }

                // CHECK: Does Receiver Exist?
                var receiverExists = await _context.Users.AnyAsync(u => u.Id == receiverId);
                if (!receiverExists)
                {
                    Console.WriteLine($"[SignalR] Error: Receiver User {receiverId} not found in DB.");
                    throw new HubException($"Receiver User {receiverId} not found.");
                }

                var msg = new Message
                {
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    Content = content,
                    Timestamp = DateTime.UtcNow,
                    IsRead = false
                };

                _context.Messages.Add(msg);
                await _context.SaveChangesAsync();
                Console.WriteLine($"[SignalR] Message Saved to DB: ID={msg.Id}");

                // 2. Real-Time Delivery Check
                // We check if Receiver has ANY active connections (Count > 0)
                if (UserConnectionCounts.ContainsKey(receiverIdStr) && UserConnectionCounts[receiverIdStr] > 0)
                {
                    // Send to the User's GROUP (Handles all their tabs automatically)
                    await Clients.Group(receiverIdStr).SendAsync("ReceiveMessage", new 
                    {
                        id = msg.Id,
                        senderId = senderId,
                        receiverId = receiverId,
                        content = content,
                        timestamp = msg.Timestamp.ToString("o")
                    });
                }
                else 
                {
                    Console.WriteLine($"[SignalR] User {receiverIdStr} is Offline. Saved to DB.");
                }
            }
            catch (DbUpdateException dbEx)
            {
                var innerMessage = dbEx.InnerException?.Message ?? dbEx.Message;
                Console.WriteLine($"[SignalR] Database Error: {innerMessage}");
                // Clean coding: Provide the actual reason to the client for easier debugging
                throw new HubException($"Database Error: {innerMessage}");
            }
            catch (Exception ex)
            {
                // ... Error handling ...
                Console.WriteLine($"[SignalR] HUB ERROR: {ex}"); // Log Full Stack Trace
                throw new HubException($"Internal Server Error: {ex.Message}");
            }
        }
        
        // Helper to check if a user is online (for ChatController usage)
        public static bool IsUserOnline(string userId)
        {
            return UserConnectionCounts.ContainsKey(userId) && UserConnectionCounts[userId] > 0;
        }
    }
}
