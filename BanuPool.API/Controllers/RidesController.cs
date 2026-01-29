using Microsoft.AspNetCore.Mvc;
using BanuPool.Core.Entities;
using BanuPool.Core.Interfaces;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;

namespace BanuPool.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RidesController : ControllerBase
    {
        private readonly IRideService _rideService;

        public RidesController(IRideService rideService)
        {
            _rideService = rideService;
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
            var success = await _rideService.CancelReservationAsync(id, userId);
            if (!success) return NotFound("Reservation not found.");
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
            var success = await _rideService.CancelRideAsync(id, request.Reason);
            if (!success) return BadRequest("Could not cancel ride");
            return Ok(new { message = "Ride cancelled" });
        }

        public class CancelRequest { public string Reason { get; set; } }
    }
}
