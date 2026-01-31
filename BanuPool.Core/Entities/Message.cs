using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BanuPool.Core.Entities
{
    public class Message
    {
        public int Id { get; set; }

        [Required]
        public int SenderId { get; set; }
        public BaseUser Sender { get; set; }

        [Required]
        public int ReceiverId { get; set; }
        public BaseUser Receiver { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; } = false;
    }
}
