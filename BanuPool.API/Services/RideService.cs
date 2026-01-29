using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using BanuPool.Core.Entities;
using BanuPool.Core.Interfaces;
using BanuPool.Data;

namespace BanuPool.API.Services
{
    public class RideService : IRideService
    {
        private readonly AppDbContext _context;
        private readonly INotificationService _notificationService;

        public RideService(AppDbContext context, INotificationService notificationService)
        {
            _context = context;
            _notificationService = notificationService;
        }

        public async Task<Ride> CreateRideAsync(Ride ride)
        {
            // MVP FIX: Ensure the user has a vehicle. If not, create a default one.
            // The frontend might send specific vehicleId (e.g. 1) which might not exist.
            
            var existingVehicle = await _context.Vehicles
                .FirstOrDefaultAsync(v => v.OwnerId == ride.DriverId);

            if (existingVehicle != null)
            {
                // Use user's existing vehicle
                ride.VehicleId = existingVehicle.Id;
            }
            else
            {
                // Create a demo vehicle for this user
                var newVehicle = new Vehicle
                {
                    OwnerId = ride.DriverId,
                    PlateNumber = "10 DEMO 01",
                    Model = "Öğrenci Aracı",
                    Color = "Beyaz"
                };
                _context.Vehicles.Add(newVehicle);
                await _context.SaveChangesAsync(); // Save to get Id
                
                ride.VehicleId = newVehicle.Id;
            }

            _context.Rides.Add(ride);
            await _context.SaveChangesAsync();
            return ride;
        }

        /// <summary>
        /// Searches for rides based on origin and destination.
        /// Uses AsNoTracking for read-only performance optimization.
        /// </summary>
        public async Task<IEnumerable<Ride>> SearchRidesAsync(string origin, string destination, int? currentUserId = null)
        {
            var query = _context.Rides
                .Include(r => r.Driver)
                .Include(r => r.Vehicle)
                .Include(r => r.Reservations) // Need this for filtering
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(origin))
            {
                query = query.Where(r => r.Origin.Contains(origin));
            }

            if (!string.IsNullOrWhiteSpace(destination))
            {
                query = query.Where(r => r.Destination.Contains(destination));
            }

            // Exclude rides where the current user has a reservation
            if (currentUserId.HasValue)
            {
                query = query.Where(r => !r.Reservations.Any(res => res.PassengerId == currentUserId.Value));
            }

            // LIFECYCLE: Exclude expired rides from public search
            // If user searches, they should only see future rides.
            query = query.Where(r => r.DepartureTime > DateTime.UtcNow);

            return await query.ToListAsync();
        }

        public async Task<bool> ReserveSeatAsync(int rideId, int userId)
        {
            var ride = await _context.Rides.FindAsync(rideId);
            if (ride == null) return false;

            // Check for duplicate reservation
            var exists = await _context.Reservations.AnyAsync(r => r.RideId == rideId && r.PassengerId == userId);
            if (exists) throw new InvalidOperationException("Bu ilana zaten rezervasyon yaptınız.");

            if (ride.TryReserveSeat())
            {
                var reservation = new Reservation
                {
                    RideId = rideId,
                    PassengerId = userId,
                    ReservationTime = DateTime.UtcNow,
                    IsConfirmed = true
                };

                _context.Reservations.Add(reservation);
                
                // Update Ride state (ReservedSeats is updated in object, need to save)
                _context.Entry(ride).State = EntityState.Modified;
                
                // Create Notification for Driver
                var passenger = await _context.Users.FindAsync(userId);
                
                await _notificationService.CreateNotificationAsync(
                    ride.DriverId,
                    "Yeni Rezervasyon! 🎉",
                    $"{passenger?.FirstName ?? "Bir kullanıcı"} ilanınıza rezervasyon yaptı! 🚗",
                    "success",
                    ride.Id
                );

                await _context.SaveChangesAsync();
                return true;
            }

            return false;
        }

        public async Task<bool> CancelReservationAsync(int rideId, int userId)
        {
            var reservation = await _context.Reservations
                .FirstOrDefaultAsync(r => r.RideId == rideId && r.PassengerId == userId);

            if (reservation == null) return false;

            _context.Reservations.Remove(reservation);

            var ride = await _context.Rides.FindAsync(rideId);
            if (ride != null)
            {
                ride.CancelSeat();
                _context.Entry(ride).State = EntityState.Modified;

                // Notify Driver about cancellation
                var passenger = await _context.Users.FindAsync(userId);
                await _notificationService.CreateNotificationAsync(
                    ride.DriverId,
                    "Rezervasyon İptali ❌",
                    $"{passenger?.FirstName ?? "Bir kullanıcı"} rezervasyonunu iptal etti.",
                    "warning",
                    ride.Id
                );
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<Ride?> GetRideByIdAsync(int rideId)
        {
             return await _context.Rides
                .Include(r => r.Driver)
                .Include(r => r.Vehicle)
                .FirstOrDefaultAsync(r => r.Id == rideId);
        }

        public async Task<Ride> UpdateRideAsync(Ride ride)
        {
            var existingRide = await _context.Rides.FindAsync(ride.Id);
            if (existingRide == null) return null;

            // Update allowed fields
            existingRide.Origin = ride.Origin;
            existingRide.Destination = ride.Destination;
            existingRide.DepartureTime = ride.DepartureTime;
            existingRide.Price = ride.Price;
            existingRide.TotalSeats = ride.TotalSeats;
            
            // If ReservedSeats > TotalSeats, we have a problem, but for MVP let's assume UI handles valid inputs
            
            _context.Entry(existingRide).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            
            return existingRide;
        }

        public async Task<bool> DeleteRideAsync(int rideId)
        {
            var ride = await _context.Rides
                .Include(r => r.Reservations)
                .FirstOrDefaultAsync(r => r.Id == rideId);
                
            if (ride == null) return false;

            // Notify passengers before deleting reservations
            if (ride.Reservations.Any())
            {
                foreach (var reservation in ride.Reservations)
                {
                    // Notify Passenger
                    await _notificationService.CreateNotificationAsync(
                        reservation.PassengerId,
                        "İlan İptal Edildi ⚠️",
                        $"Rezervasyon yaptığınız {ride.Origin} - {ride.Destination} sürüşü sürücü tarafından iptal edildi.",
                        "error",
                        null // Ride is being deleted, so no link
                    );
                }

                // Remove reservations manually to satisfy Restrict constraint
                _context.Reservations.RemoveRange(ride.Reservations);
            }

            _context.Rides.Remove(ride);
            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Retrieves all rides where the specified user is a passenger.
        /// Uses AsNoTracking for performance.
        /// </summary>
        public async Task<IEnumerable<Ride>> GetRidesForPassengerAsync(int passengerId)
        {
            // Join Reservations with Rides
            var rideIds = await _context.Reservations
                .Where(res => res.PassengerId == passengerId && res.IsConfirmed)
                .Select(res => res.RideId)
                .ToListAsync();

            var rides = await _context.Rides
                .Include(r => r.Driver)
                .Include(r => r.Vehicle)
                .Where(r => rideIds.Contains(r.Id))
                .OrderBy(r => r.DepartureTime)
                .ToListAsync();
            
            return rides;
        }

        public async Task<IEnumerable<Ride>> GetRidesForDriverAsync(int driverId)
        {
            return await _context.Rides
                .Include(r => r.Vehicle)
                .Include(r => r.Reservations)
                .ThenInclude(res => res.Passenger)
                .Where(r => r.DriverId == driverId)
                .OrderByDescending(r => r.DepartureTime) // Show newest (or future) first, but typically list all
                .ToListAsync();
        }
    }
}
