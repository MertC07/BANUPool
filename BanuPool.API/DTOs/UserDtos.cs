using BanuPool.Core.Entities;

namespace BanuPool.API.DTOs
{
    public class UserProfileDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string PhoneNumber { get; set; }
        public string UserType { get; set; } // Student or Academician
        
        // Vehicle Info (Optional)
        public VehicleDto? Vehicle { get; set; }
    }

    public class VehicleDto
    {
        public string PlateNumber { get; set; }
        public string Model { get; set; }
        public string Color { get; set; }
    }
}
