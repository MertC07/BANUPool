using System;

namespace BanuPool.Core.Entities
{
    public class Notification
    {
        public int Id { get; set; }
        public int UserId { get; set; } // The recipient
        public string Title { get; set; }
        public string Message { get; set; }
        public string Type { get; set; } // "success" (booking), "warning" (cancellation), "info"
        public bool IsRead { get; set; }
        public int? RideId { get; set; } // Optional link to a ride
        public int? SenderId { get; set; } // The user causing the notification
        public BaseUser Sender { get; set; } // Navigation property
        
        public BaseUser User { get; set; } // Navigation property to UserId

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
