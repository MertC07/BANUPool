using Microsoft.AspNetCore.Mvc;
using BanuPool.Core.Entities;
using BanuPool.Core.Interfaces;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.AspNetCore.SignalR;
using BanuPool.API.Hubs;
using Microsoft.EntityFrameworkCore;

namespace BanuPool.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RidesController : ControllerBase
    {
        private readonly IRideService _rideService;
        private readonly IHubContext<RideHub> _hubContext;
        private readonly BanuPool.Data.AppDbContext _context;

        public RidesController(IRideService rideService, IHubContext<RideHub> hubContext, BanuPool.Data.AppDbContext context)
        {
            _rideService = rideService;
            _hubContext = hubContext;
            _context = context;
        }

        [HttpPost]
        public async Task<ActionResult<Ride>> CreateRide(Ride ride)
        {
            // Security: Enforce DriverId from Token
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;
            
            if (userIdClaim == null) return Unauthorized();
            
            ride.DriverId = int.Parse(userIdClaim);

            var createdRide = await _rideService.CreateRideAsync(ride);
            return CreatedAtAction(nameof(GetRide), new { id = createdRide.Id }, createdRide);
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<BanuPool.API.DTOs.RideDto>>> SearchRides([FromQuery] string? origin, [FromQuery] string? destination, [FromQuery] int? userId)
        {
            try
            {
                var rides = await _rideService.SearchRidesAsync(origin ?? "", destination ?? "", userId);
                
                // Map to DTO to prevent JSON Cycles and hide sensitive data
                var dtos = rides.Select(r => new BanuPool.API.DTOs.RideDto
                {
                    Id = r.Id,
                    Origin = r.Origin,
                    Destination = r.Destination,
                    DepartureTime = r.DepartureTime,
                    Price = r.Price,
                    TotalSeats = r.TotalSeats,
                    ReservedSeats = r.ReservedSeats,
                    Driver = new BanuPool.API.DTOs.RideDriverDto
                    {
                        Id = r.Driver?.Id ?? 0,
                        FirstName = r.Driver?.FirstName ?? "Unknown",
                        LastName = r.Driver?.LastName ?? "User",
                        PhoneNumber = r.Driver?.PhoneNumber ?? ""
                    },
                    Vehicle = r.Vehicle != null ? new BanuPool.API.DTOs.VehicleDto
                    {
                        PlateNumber = r.Vehicle.PlateNumber,
                        Model = r.Vehicle.Model,
                        Color = r.Vehicle.Color
                    } : null
                }).ToList(); // Execute immediately to catch mapping errors here

                return Ok(dtos);
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { error = $"Server Error: {ex.Message}" });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Ride>> GetRide(int id)
        {
            var ride = await _rideService.GetRideByIdAsync(id);
            if (ride == null) return NotFound();
            return Ok(ride);
        }

        [HttpPost("{id}/reserve")]
        public async Task<IActionResult> ReserveSeat(int id, [FromQuery] int userId)
        {
            try
            {
                var success = await _rideService.ReserveSeatAsync(id, userId);
                if (!success) return BadRequest("Yer yok veya ilan bulunamadı.");

                // SIGNALR NOTIFICATION: Notify Driver
                var ride = await _rideService.GetRideByIdAsync(id);
                if (ride != null && ride.DriverId != 0)
                {
                    // 1. SAVE TO DB
                    var notification = new Notification
                    {
                        UserId = ride.DriverId,
                        Title = "Yeni Rezervasyon",
                        Message = $"{ride.Origin} -> {ride.Destination} ({ride.DepartureTime:HH:mm}) ilanınıza yeni bir rezervasyon yapıldı!",
                        Type = "success",
                        RideId = id,
                        SenderId = userId,
                        IsRead = false,
                        CreatedAt = System.DateTime.UtcNow
                    };
                    _context.Notifications.Add(notification);
                    await _context.SaveChangesAsync();

                    // 2. SEND REAL-TIME
                    await _hubContext.Clients.User(ride.DriverId.ToString())
                        .SendAsync("ReceiveBookingNotification", notification.Message);
                }

                return Ok("Reservation confirmed.");
            }
            catch (System.InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}/reserve")]
        public async Task<IActionResult> CancelReservation(int id, [FromQuery] int userId)
        {
            // Get ride first to notify driver
            var ride = await _rideService.GetRideByIdAsync(id);

            var success = await _rideService.CancelReservationAsync(id, userId);
            if (!success) return NotFound("Reservation not found.");

            // NOTIFY DRIVER
            if (ride != null && ride.DriverId != 0 && ride.DriverId != userId)
            {
                // 1. SAVE TO DB
                var notification = new Notification
                {
                    UserId = ride.DriverId,
                    Title = "Rezervasyon İptali",
                    Message = $"{ride.Origin} -> {ride.Destination} ({ride.DepartureTime:HH:mm}) ilanınızdan bir yolcu rezervasyonunu iptal etti.",
                    Type = "warning",
                    RideId = ride.Id,
                    SenderId = userId,
                    IsRead = false,
                    CreatedAt = System.DateTime.UtcNow
                };
                _context.Notifications.Add(notification);
                await _context.SaveChangesAsync();

                // 2. SEND REAL-TIME
                await _hubContext.Clients.User(ride.DriverId.ToString())
                    .SendAsync("ReceiveCancellationNotification", notification.Message);
            }

            return Ok("Reservation cancelled.");
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRide(int id, Ride ride)
        {
            if (id != ride.Id) return BadRequest();
            
            var updatedRide = await _rideService.UpdateRideAsync(ride);
            if (updatedRide == null) return NotFound();
            
            return Ok(updatedRide);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRide(int id)
        {
            var success = await _rideService.DeleteRideAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpGet("passenger/{userId}")]
        public async Task<IEnumerable<Ride>> GetPassengerRides(int userId)
        {
            return await _rideService.GetRidesForPassengerAsync(userId);
        }
        [HttpGet("driver/{userId}")]
        public async Task<ActionResult<IEnumerable<Ride>>> GetDriverRides(int userId, [FromQuery] bool history = false)
        {
            // Security check
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;
            
            if (userIdClaim == null || int.Parse(userIdClaim) != userId) return Unauthorized();

            var rides = await _rideService.GetRidesForDriverAsync(userId, history);
            return Ok(rides);
        }

        [HttpPost("{id}/archive")]
        public async Task<IActionResult> ArchiveRide(int id)
        {
            var success = await _rideService.ArchiveRideAsync(id);
            if (!success) return BadRequest($"Could not archive ride {id} (Not found or error)");
            return Ok(new { message = "Ride archived" });
        }

        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelRide(int id, [FromBody] CancelRequest request)
        {
            // Fetch passengers BEFORE cancelling to notify them
            var ride = await _rideService.GetRideByIdAsync(id);
            if (ride == null) return NotFound();

            var success = await _rideService.CancelRideAsync(id, request.Reason);
            if (!success) return BadRequest("Could not cancel ride");

            // SIGNALR NOTIFICATION: Notify All Passengers
            // 3. Notify Passengers (Persistent + SignalR)
            var rideWithPassengers = await _context.Rides
                .Include(r => r.Reservations)
                .ThenInclude(res => res.Passenger)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (rideWithPassengers?.Reservations != null)
            {
                foreach (var reservation in rideWithPassengers.Reservations)
                {
                    var passenger = reservation.Passenger;
                    if (passenger != null)
                    {
                         // 1. SAVE TO DB
                        var notification = new Notification
                        {
                            UserId = passenger.Id,
                            Title = "Rezervasyon İptali",
                            Message = $"{rideWithPassengers.Origin} -> {rideWithPassengers.Destination} ({rideWithPassengers.DepartureTime:HH:mm}) seferiniz iptal edildi. Sürücü iptal nedeni: {request.Reason}",
                            Type = "warning",
                            RideId = id,
                            SenderId = rideWithPassengers.DriverId,
                            IsRead = false,
                            CreatedAt = System.DateTime.UtcNow
                        };
                        _context.Notifications.Add(notification);
                        
                        // 2. SEND REAL-TIME
                        await _hubContext.Clients.User(passenger.Id.ToString())
                            .SendAsync("ReceiveCancellationNotification", notification.Message);
                    }
                }
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Ride cancelled" });
        }

        [HttpGet("check-reservation-status")]
        public async Task<IActionResult> CheckReservationStatus([FromQuery] int targetUserId)
        {
             var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("UserId")?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int currentUserId)) return Unauthorized();

            // Check if there is ANY ride where:
            // 1. Current User is Driver AND Target User is Passenger (with specific status if needed, assuming existence implies some relation)
            // 2. Target User is Driver AND Current User is Passenger
            
            // Note: Reservation entity doesn't explicitly have a 'Status' enum visible in previous files, 
            // but usually existence in Reservations table implies booked/pending unless we have a Status column.
            // Reviewing AppDbContext, I don't see a Status on Reservation, but I see Status on Ride.
            // If the user said "Approved or Pending", and we don't have a status on Reservation, 
            // we assume existence of a record means "Active".
            
            bool hasReservation = await _context.Reservations
                .Include(r => r.Ride)
                .AnyAsync(r => 
                    (r.PassengerId == targetUserId && r.Ride.DriverId == currentUserId) ||
                    (r.PassengerId == currentUserId && r.Ride.DriverId == targetUserId)
                );

            return Ok(hasReservation);
        }

        public class CancelRequest { public string Reason { get; set; } }
    }
}
