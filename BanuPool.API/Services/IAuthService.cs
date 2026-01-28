using System.Threading.Tasks;
using BanuPool.API.DTOs;
using BanuPool.Core.Entities;

namespace BanuPool.API.Services
{
    public interface IAuthService
    {
        Task<BaseUser?> RegisterAsync(RegisterDto dto);
        Task<AuthResponseDto?> LoginAsync(LoginDto dto);
    }
}
