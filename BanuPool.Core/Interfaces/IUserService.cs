using System.Threading.Tasks;
using BanuPool.Core.Entities;

namespace BanuPool.Core.Interfaces
{
    public interface IUserService
    {
        Task<BaseUser?> GetUserByIdAsync(int id);
        Task<Vehicle?> GetVehicleByUserIdAsync(int userId);
        Task<BaseUser> UpdateUserAsync(BaseUser user, Vehicle? vehicle);
    }
}
