using System;
using System.Collections.Generic;

namespace BanuPool.Core.Entities
{
    public abstract class BaseUser
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public double ReputationScore { get; set; } = 5.0; // Default starts at 5.0
        public string? ProfilePhotoPath { get; set; }

        // Navigation Properties can be added here later
    }
}
