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
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
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
                    m.Timestamp,
                    m.IsRead
                })
                .ToListAsync();

            return Ok(messages);
        }

        // Optional: Mark messages as read
        [HttpPost("read/{targetUserId}")]
        public async Task<IActionResult> MarkRead(int targetUserId)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int currentUserId)) return Unauthorized();

            var unreadMessages = await _context.Messages
                .Where(m => m.SenderId == targetUserId && m.ReceiverId == currentUserId && !m.IsRead)
                .ToListAsync();

            if (unreadMessages.Any())
            {
                foreach (var msg in unreadMessages)
                {
                    msg.IsRead = true;
                }
                await _context.SaveChangesAsync();
            }

            return Ok();
        }

        [HttpGet("contacts")]
        public async Task<IActionResult> GetContacts()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int currentUserId)) return Unauthorized();

            // Find all unique users involved in messages with current user
            var contactIds = await _context.Messages
                .Where(m => m.SenderId == currentUserId || m.ReceiverId == currentUserId)
                .Select(m => m.SenderId == currentUserId ? m.ReceiverId : m.SenderId)
                .Distinct()
                .ToListAsync();

            if (!contactIds.Any()) return Ok(new List<object>()); // Return empty list

            // Fetch User Details
            var contacts = await _context.Users
                .Where(u => contactIds.Contains(u.Id))
                .Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.ProfilePhotoPath
                })
                .ToListAsync();

            // Map to DTO with Online Status
            var contactDtos = contacts.Select(c => new 
            {
                c.Id,
                c.FirstName,
                c.LastName,
                ProfilePhotoPath = c.ProfilePhotoPath,
                IsOnline = BanuPool.API.Hubs.ChatHub.OnlineUsers.ContainsKey(c.Id.ToString())
            });

            return Ok(contactDtos);
        }
    }
}

