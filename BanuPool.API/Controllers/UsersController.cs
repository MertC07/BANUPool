using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using BanuPool.API.DTOs;
using BanuPool.Core.Interfaces;
using BanuPool.Core.Entities;

namespace BanuPool.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            _userService = userService;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<UserProfileDto>> GetProfile(int id)
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null) return NotFound("Kullanıcı bulunamadı.");

            var vehicle = await _userService.GetVehicleByUserIdAsync(id);

            var dto = new UserProfileDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                UserType = user is Student ? "Öğrenci" : "Akademisyen",
                Vehicle = vehicle != null ? new VehicleDto
                {
                    PlateNumber = vehicle.PlateNumber,
                    Model = vehicle.Model,
                    Color = vehicle.Color
                } : null
            };

            return Ok(dto);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<UserProfileDto>> UpdateProfile(int id, UserProfileDto dto)
        {
            if (id != dto.Id) return BadRequest();

            var user = await _userService.GetUserByIdAsync(id);
            if (user == null) return NotFound();

            // Map DTO to Entity bits
            user.FirstName = dto.FirstName;
            user.LastName = dto.LastName;
            user.PhoneNumber = dto.PhoneNumber;
            
            Vehicle? vehicleUpdate = null;
            if (dto.Vehicle != null)
            {
                vehicleUpdate = new Vehicle
                {
                    PlateNumber = dto.Vehicle.PlateNumber,
                    Model = dto.Vehicle.Model,
                    Color = dto.Vehicle.Color
                };
            }

            await _userService.UpdateUserAsync(user, vehicleUpdate);

            return Ok(dto);
        }
    }
}
