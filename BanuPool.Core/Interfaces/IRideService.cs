using System.Collections.Generic;
using System.Threading.Tasks;
using BanuPool.Core.Entities;

namespace BanuPool.Core.Interfaces
{
    public interface IRideService
    {
        Task<Ride> CreateRideAsync(Ride ride);
        Task<IEnumerable<Ride>> SearchRidesAsync(string origin, string destination, int? currentUserId = null);
        Task<bool> ReserveSeatAsync(int rideId, int userId);
        Task<Ride?> GetRideByIdAsync(int rideId);
        Task<Ride> UpdateRideAsync(Ride ride);
        Task<bool> DeleteRideAsync(int rideId);
        Task<bool> CancelReservationAsync(int rideId, int userId);
        Task<IEnumerable<Ride>> GetRidesForPassengerAsync(int passengerId);
        Task<IEnumerable<Ride>> GetRidesForDriverAsync(int driverId, bool historyMode = false);
        Task<bool> ArchiveRideAsync(int rideId);
        Task<bool> CancelRideAsync(int rideId, string reason);
    }
}
