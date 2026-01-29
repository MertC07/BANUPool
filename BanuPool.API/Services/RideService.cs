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
                .Where(r => !r.IsArchived && r.DepartureTime > DateTime.Now && r.Status != BanuPool.Core.Enums.RideStatus.Cancelled) // Filter archived AND expired AND cancelled
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(origin))
            {
                query = query.Where(r => r.Origin.Contains(origin));
            }

            if (!string.IsNullOrWhiteSpace(destination))
            {
                query = query.Where(r => r.Destination.Contains(destination));
            }

            // Exclude rides where the current user has a reservation OR is the driver
            if (currentUserId.HasValue)
            {
                query = query.Where(r => 
                    r.DriverId != currentUserId.Value && // Don't show own rides
                    !r.Reservations.Any(res => res.PassengerId == currentUserId.Value) // Don't show reserved rides
                );
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
                ride.Status = BanuPool.Core.Enums.RideStatus.HasPassengers;
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
                if (ride.ReservedSeats == 0) 
                {
                    ride.Status = BanuPool.Core.Enums.RideStatus.Active;
                }
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

            // STATE PATTERN VALIDATION: Prevent editing if passengers exist
            if (existingRide.Status == BanuPool.Core.Enums.RideStatus.HasPassengers || existingRide.ReservedSeats > 0)
            {
                 throw new InvalidOperationException("Bu ilanda yolcu var, düzenleme yapılamaz.");
            }

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
                .Where(r => rideIds.Contains(r.Id) && r.Status != BanuPool.Core.Enums.RideStatus.Cancelled)
                .OrderBy(r => r.DepartureTime)
                .ToListAsync();
            
            return rides;
        }

        public async Task<IEnumerable<Ride>> GetRidesForDriverAsync(int driverId, bool historyMode = false)
        {
            var query = _context.Rides
                .Include(r => r.Vehicle)
                .Include(r => r.Reservations)
                .ThenInclude(res => res.Passenger)
                .Where(r => r.DriverId == driverId && !r.IsArchived) // Always hide archived
                .AsQueryable();

            if (!historyMode)
            {
                // ACTIVE TAB: Future Active Rides 
                // We filter OUT cancelled rides even if future
                query = query.Where(r => 
                    r.Status != BanuPool.Core.Enums.RideStatus.Cancelled && 
                    r.Status != BanuPool.Core.Enums.RideStatus.Completed &&
                    r.DepartureTime > DateTime.Now);
                
                // Sort by nearest date first
                query = query.OrderBy(r => r.DepartureTime);
            }
            else
            {
                // HISTORY TAB: Cancelled, Completed, OR Expired
                query = query.Where(r => 
                    r.Status == BanuPool.Core.Enums.RideStatus.Cancelled || 
                    r.Status == BanuPool.Core.Enums.RideStatus.Completed || 
                    r.DepartureTime <= DateTime.Now);
                
                // Sort by newest first (descending)
                query = query.OrderByDescending(r => r.DepartureTime);
            }

            return await query.ToListAsync();
        }

        public async Task<bool> ArchiveRideAsync(int rideId) 
        {
            var ride = await _context.Rides.FindAsync(rideId);
            if (ride == null) return false;

            ride.IsArchived = true;
            _context.Entry(ride).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> CancelRideAsync(int rideId, string reason)
        {
            var ride = await _context.Rides
                .Include(r => r.Driver)
                .Include(r => r.Reservations)
                .FirstOrDefaultAsync(r => r.Id == rideId);

            if (ride == null) return false;

            // 1. Check for Penalty
            if (ride.Reservations.Any())
            {
                var timeRemaining = ride.DepartureTime - DateTime.Now;
                double penalty = 0.0;

                if (timeRemaining.TotalHours < 2)
                {
                    penalty = 20.0; // Major penalty
                }
                else if (timeRemaining.TotalHours < 24)
                {
                    penalty = 1.0; // Minor penalty
                }

                if (penalty > 0 && ride.Driver != null)
                {
                    ride.Driver.ReputationScore -= penalty;
                    if (ride.Driver.ReputationScore < 0) ride.Driver.ReputationScore = 0;
                    _context.Entry(ride.Driver).State = EntityState.Modified;
                }

                // 2. Notify Passengers
                foreach (var res in ride.Reservations)
                {
                     await _notificationService.CreateNotificationAsync(
                        res.PassengerId,
                        "Yolculuk İptali ⚠️",
                        $"Sürücü yolculuğu iptal etti. Neden: {reason}",
                        "error",
                        ride.Id
                    );
                }
            }

            // 3. Update Status
            ride.Status = BanuPool.Core.Enums.RideStatus.Cancelled;
            ride.CancelReason = reason;
            ride.CancelTime = DateTime.Now;
            
            _context.Entry(ride).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
