using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Collections.Concurrent;

namespace BanuPool.API.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        // Optional: Map users to connection IDs if you want to track them manually.
        // But SignalR has built-in User ID mapping if we interpret the claims correctly.
        // Standard `Clients.User(userId)` works if `IUserIdProvider` is set up or Default uses NameIdentifier.

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                         ?? Context.User?.FindFirst("UserId")?.Value;
            
            // Helpful logging or tracking logic here if needed
            await base.OnConnectedAsync();
        }

        public async Task SendNotification(string userId, object notification)
        {
            // This method might be called by the client, but usually the server initiates notifications.
            // If we want client-to-client notifications (unlikely for this app structure), we use this.
            await Clients.User(userId).SendAsync("ReceiveNotification", notification);
        }
    }
}
