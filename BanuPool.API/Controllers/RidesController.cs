using Microsoft.AspNetCore.Mvc;
using BanuPool.Core.Entities;
using BanuPool.Core.Interfaces;
using System.Collections.Generic;
using System.Threading.Tasks;

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
            var createdRide = await _rideService.CreateRideAsync(ride);
            return CreatedAtAction(nameof(GetRide), new { id = createdRide.Id }, createdRide);
        }

        [HttpGet]
        public async Task<IEnumerable<Ride>> SearchRides([FromQuery] string? origin, [FromQuery] string? destination)
        {
            return await _rideService.SearchRidesAsync(origin ?? "", destination ?? "");
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
            var success = await _rideService.ReserveSeatAsync(id, userId);
            if (!success) return BadRequest("Could not reserve seat (Full or Ride not found).");
            return Ok("Reservation confirmed.");
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
    }
}
