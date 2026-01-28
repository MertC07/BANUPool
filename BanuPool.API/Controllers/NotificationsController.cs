using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BanuPool.Data;
using BanuPool.Core.Entities;
using Microsoft.AspNetCore.Authorization;

namespace BanuPool.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public NotificationsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("{userId}")]
        public async Task<IActionResult> GetUnread(int userId)
        {
            var notes = await _context.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(20)
                .ToListAsync();
            return Ok(notes);
        }

        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var note = await _context.Notifications.FindAsync(id);
            if (note == null) return NotFound();

            note.IsRead = true;
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var note = await _context.Notifications.FindAsync(id);
            if (note == null) return NotFound();

            _context.Notifications.Remove(note);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPut("read-all/{userId}")]
        public async Task<IActionResult> MarkAllRead(int userId)
        {
            var notes = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            if (!notes.Any()) return Ok();

            foreach (var note in notes)
            {
                note.IsRead = true;
            }
            await _context.SaveChangesAsync();
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("delete-all/{userId}")]
        public async Task<IActionResult> DeleteAll(int userId)
        {
            var notes = await _context.Notifications
                .Where(n => n.UserId == userId)
                .ToListAsync();

            if (!notes.Any()) return Ok();

            _context.Notifications.RemoveRange(notes);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}
