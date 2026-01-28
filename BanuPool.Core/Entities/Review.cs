using System;

namespace BanuPool.Core.Entities
{
    public class Review
    {
        public int Id { get; set; }
        
        public int RaterId { get; set; } // Reviewer
        public BaseUser? Rater { get; set; }
        
        public int RateeId { get; set; } // Reviewed User (Driver or Passenger)
        public BaseUser? Ratee { get; set; }
        
        public int RideId { get; set; }
        public Ride? Ride { get; set; }
        
        public int Score { get; set; } // 1-5
        public string Comment { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
