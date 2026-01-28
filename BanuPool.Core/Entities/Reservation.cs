using System;

namespace BanuPool.Core.Entities
{
    public class Reservation
    {
        public int Id { get; set; }
        
        public int RideId { get; set; }
        public Ride? Ride { get; set; }
        
        public int PassengerId { get; set; }
        public BaseUser? Passenger { get; set; }
        
        public DateTime ReservationTime { get; set; } = DateTime.UtcNow;
        public bool IsConfirmed { get; set; } = true;
    }
}
