using System;
using System.Collections.Generic;

namespace BanuPool.Core.Entities
{
    public class Ride
    {
        public int Id { get; set; }
        
        public int DriverId { get; set; }
        public BaseUser? Driver { get; set; }

        public string Origin { get; set; } = string.Empty;
        public string Destination { get; set; } = string.Empty;
        public DateTime DepartureTime { get; set; }
        public bool IsArchived { get; set; } = false; // Soft Delete
        public BanuPool.Core.Enums.RideStatus Status { get; set; } = BanuPool.Core.Enums.RideStatus.Active;
        public string? CancelReason { get; set; }
        public DateTime? CancelTime { get; set; }
        
        public int VehicleId { get; set; }
        public Vehicle? Vehicle { get; set; }
        
        public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
        
        // Encapsulation: AvailableSeats managed via methods
        public int TotalSeats { get; set; }
        public int ReservedSeats { get; private set; }
        
        public decimal Price { get; set; }

        public Ride(int totalSeats)
        {
            TotalSeats = totalSeats;
            ReservedSeats = 0;
        }
        
        // Required for EF Core
        protected Ride() { }

        public bool TryReserveSeat()
        {
            if (AvailableSeats > 0)
            {
                ReservedSeats++;
                return true;
            }
            return false;
        }

        public void CancelSeat()
        {
            if (ReservedSeats > 0)
                ReservedSeats--;
        }

        public int AvailableSeats => TotalSeats - ReservedSeats;
    }
}
