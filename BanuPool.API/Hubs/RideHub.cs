using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;

namespace BanuPool.API.Hubs
{
    [Authorize]
    public class RideHub : Hub
    {
        // Clients automatically join a group based on their UserIdentifier (UserId) if using default behaviors,
        // but often it's easier to just use Clients.User(userId).
        // Since we configured JWT Auth, Context.UserIdentifier will be populated with the ClaimTypes.NameIdentifier.

        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(System.Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }
    }
}
