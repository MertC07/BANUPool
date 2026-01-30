using System;

namespace BanuPool.API.DTOs
{
    public class NotificationDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Type { get; set; } = "info";
        public bool IsRead { get; set; }
        public int? RideId { get; set; }
        public int? SenderId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string SenderInitials { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
