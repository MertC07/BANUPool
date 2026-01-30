using Microsoft.AspNetCore.Mvc;
using BanuPool.Core.Entities;
using BanuPool.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;

namespace BanuPool.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public NotificationsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("unread")]
        public async Task<ActionResult<IEnumerable<BanuPool.API.DTOs.NotificationDto>>> GetUnreadNotifications()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;

            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim);

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new BanuPool.API.DTOs.NotificationDto
                {
                    Id = n.Id,
                    Title = n.Title,
                    Message = n.Message,
                    Type = n.Type,
                    IsRead = n.IsRead,
                    RideId = n.RideId,
                    SenderId = n.SenderId,
                    SenderName = n.Sender != null ? n.Sender.FirstName + " " + n.Sender.LastName : "Sistem",
                    SenderPhoto = n.Sender != null ? n.Sender.ProfilePhotoPath : null,
                    SenderInitials = n.Sender != null ? (n.Sender.FirstName.Substring(0,1) + n.Sender.LastName.Substring(0,1)) : "S",
                    CreatedAt = n.CreatedAt
                })
                .ToListAsync();

            return Ok(notifications);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<BanuPool.API.DTOs.NotificationDto>>> GetNotifications()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;

            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim);

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new BanuPool.API.DTOs.NotificationDto
                {
                    Id = n.Id,
                    Title = n.Title,
                    Message = n.Message,
                    Type = n.Type,
                    IsRead = n.IsRead,
                    RideId = n.RideId,
                    SenderId = n.SenderId,
                    SenderName = n.Sender != null ? n.Sender.FirstName + " " + n.Sender.LastName : "Sistem",
                    SenderPhoto = n.Sender != null ? n.Sender.ProfilePhotoPath : null,
                    SenderInitials = n.Sender != null ? (n.Sender.FirstName.Substring(0,1) + n.Sender.LastName.Substring(0,1)) : "S",
                    CreatedAt = n.CreatedAt
                })
                .ToListAsync();

            return Ok(notifications);
        }

        [HttpPost("mark-as-read/{id}")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;

            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim);

            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null) return NotFound();

            if (notification.UserId != userId) return Forbid();

            notification.IsRead = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Marked as read" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNotification(int id)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;

            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim);

            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null) return NotFound();

            if (notification.UserId != userId) return Forbid();

            _context.Notifications.Remove(notification);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Deleted" });
        }
        [HttpPost("mark-all-read")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;

            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim);

            var unreadNotifications = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            if (unreadNotifications.Any())
            {
                foreach (var n in unreadNotifications) n.IsRead = true;
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "All marked as read" });
        }

        [HttpPost("delete-batch")]
        public async Task<IActionResult> DeleteBatch([FromBody] List<int> ids)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;

            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim);

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId && ids.Contains(n.Id))
                .ToListAsync();

            if (notifications.Any())
            {
                _context.Notifications.RemoveRange(notifications);
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Batch deleted" });
        }
    }
}
