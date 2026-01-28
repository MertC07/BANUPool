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
    public class ReviewsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReviewsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> AddReview([FromBody] Review review)
        {
            // Validate standard stuff
            if (review.Score < 1 || review.Score > 5)
                return BadRequest("Puan 1 ile 5 arasında olmalıdır.");

            // Check if user actually shared a ride? (Optional validation for MVP)
            
            review.CreatedAt = DateTime.UtcNow;
            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();

            return Ok(review);
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserReviews(int userId)
        {
            var reviews = await _context.Reviews
                .Include(r => r.Rater)
                .Where(r => r.RateeId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return Ok(reviews);
        }

        [HttpGet("average/{userId}")]
        public async Task<IActionResult> GetUserAverage(int userId)
        {
            var reviews = await _context.Reviews
                .Where(r => r.RateeId == userId)
                .ToListAsync();

            if (!reviews.Any()) return Ok(new { average = 5.0, count = 0 }); // Default 5.0 or 0

            var avg = reviews.Average(r => r.Score);
            return Ok(new { average = Math.Round(avg, 1), count = reviews.Count });
        }
    }
}
