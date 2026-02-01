using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BanuPool.Data;
using System.Security.Claims;
using System.Collections.Generic;
using System.Linq;
using BanuPool.API.Hubs;

namespace BanuPool.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ChatController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("history/{targetUserId}")]
        public async Task<IActionResult> GetHistory(int targetUserId)
        {
            try
            {
                var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                               ?? User.FindFirst("UserId")?.Value;

                if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int currentUserId))
                {
                    return Unauthorized();
                }

                var messages = await _context.Messages
                    .Where(m => (m.SenderId == currentUserId && m.ReceiverId == targetUserId) ||
                                (m.SenderId == targetUserId && m.ReceiverId == currentUserId))
                    .OrderBy(m => m.Timestamp)
                    .Select(m => new 
                    {
                        m.Id,
                        m.SenderId,
                        m.ReceiverId,
                        m.Content,
                        m.Timestamp, // Fetch as is (Unspecified/UTC from DB)
                        m.IsRead
                    })
                    .ToListAsync();

                // Post-processing in memory to ensure UTC string format (High Precision Fix)
                var result = messages.Select(m => new
                {
                    m.Id,
                    m.SenderId,
                    m.ReceiverId,
                    m.Content,
                    // FIX: Force Kind=Utc so .ToString("o") adds the critical 'Z' suffix.
                    // SQLite returns Unspecified, so we must tell C# "This is UTC data".
                    Timestamp = DateTime.SpecifyKind(m.Timestamp, DateTimeKind.Utc).ToString("o"), 
                    m.IsRead
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[API] GetHistory ERROR: {ex}");
                return StatusCode(500, ex.Message);
            }
        }

        // ... MarkRead remains same ...

        [HttpGet("contacts")]
        public async Task<IActionResult> GetContacts()
        {
            try 
            {
                var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                               ?? User.FindFirst("UserId")?.Value;

                if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int currentUserId)) 
                {
                    return Unauthorized("User ID not found.");
                }

                // Find contacts logic...
                var contactIds = await _context.Messages
                    .Where(m => m.SenderId == currentUserId || m.ReceiverId == currentUserId)
                    .Select(m => m.SenderId == currentUserId ? m.ReceiverId : m.SenderId)
                    .Distinct()
                    .ToListAsync();

                if (!contactIds.Any()) return Ok(new List<object>()); 

                // Fetch details
                var contacts = await _context.Users
                    .Where(u => contactIds.Contains(u.Id))
                    .Select(u => new
                    {
                        u.Id,
                        u.FirstName,
                        u.LastName,
                        u.ProfilePhotoPath,
                        u.LastActiveAt
                    })
                    .ToListAsync();

                // Map results
                var contactDtos = contacts.Select(c => new 
                {
                    c.Id,
                    c.FirstName,
                    c.LastName,
                    ProfilePhotoPath = c.ProfilePhotoPath,
                    // Use helper
                    IsOnline = BanuPool.API.Hubs.ChatHub.IsUserOnline(c.Id.ToString()),
                    
                    // FIX: Force Kind=Utc for LastActiveAt as well
                    LastActiveAt = c.LastActiveAt.HasValue 
                        ? DateTime.SpecifyKind(c.LastActiveAt.Value, DateTimeKind.Utc).ToString("o")
                        : null
                });

                return Ok(contactDtos);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[API] GetContacts ERROR: {ex}");
                return StatusCode(500, $"Internal Server Error: {ex.Message}");
            }
        }
    }
}

