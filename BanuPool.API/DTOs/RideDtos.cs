using System;
using BanuPool.Core.Entities;

namespace BanuPool.API.DTOs
{
    public class RideDto
    {
        public int Id { get; set; }
        public string Origin { get; set; }
        public string Destination { get; set; }
        public DateTime DepartureTime { get; set; }
        public decimal Price { get; set; }
        public int TotalSeats { get; set; }
        public int ReservedSeats { get; set; }
        
        public RideDriverDto Driver { get; set; }
        public VehicleDto? Vehicle { get; set; }
    }

    public class RideDriverDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string PhoneNumber { get; set; }
        // Exclude sensitive data like Email, PasswordHash
    }
}
