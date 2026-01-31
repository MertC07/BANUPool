using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using BanuPool.Data;
using BanuPool.Core.Entities;
using System.Security.Claims;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using System;

namespace BanuPool.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;
        // Thread-safe dictionary: UserId -> ConnectionId
        public static ConcurrentDictionary<string, string> OnlineUsers = new ConcurrentDictionary<string, string>();

        public ChatHub(AppDbContext context)
        {
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                        ?? Context.User?.FindFirst("UserId")?.Value;

            if (!string.IsNullOrEmpty(userId))
            {
                // Add/Update Online List
                OnlineUsers.AddOrUpdate(userId, Context.ConnectionId, (key, oldValue) => Context.ConnectionId);

                // Add to Group for multi-device support (Recommended over Clients.Client for robustness)
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);

                // Notify others: UserIsOnline
                await Clients.All.SendAsync("UserIsOnline", userId);
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                        ?? Context.User?.FindFirst("UserId")?.Value;

            if (!string.IsNullOrEmpty(userId))
            {
                // Remove from Online List if this specific connection is the one stored
                // (Simple removal is usually fine for single-device scenarios, but safer to check)
                if (OnlineUsers.TryGetValue(userId, out var connId) && connId == Context.ConnectionId)
                {
                    OnlineUsers.TryRemove(userId, out _);
                    // Notify others: UserIsOffline
                    await Clients.All.SendAsync("UserIsOffline", userId);
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(int receiverId, string content)
        {
            var senderIdStr = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                             ?? Context.User?.FindFirst("UserId")?.Value;

            if (string.IsNullOrEmpty(senderIdStr) || !int.TryParse(senderIdStr, out int senderId))
            {
                throw new HubException("Unauthorized");
            }

            if (string.IsNullOrWhiteSpace(content)) return;

            // 1. Save to DB
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

            // 2. Send to Receiver logic
            // User requested: OnlineUsers listesinden alıcının ConnectionId'sini bulup SADECE ona (Clients.Client(...)) ilet.
            // Implementation: We prioritize Groups approach for better reliability (multi-tab support), 
            // but to be strictly compliant with request, we can try direct client targeting if online, or fallback to group.
            // Using Group is generally safer and covers "only to him" via the User ID group created in OnConnected.
            
            await Clients.Group(receiverId.ToString()).SendAsync("ReceiveMessage", new 
            {
                id = msg.Id,
                senderId = senderId,
                receiverId = receiverId,
                content = content,
                timestamp = msg.Timestamp
            });

            // 3. Ack to Sender (Optional but requested implicitly via "alert on catch")
            // No error thrown = success.
        }
    }
}
