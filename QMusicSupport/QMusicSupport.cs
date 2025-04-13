using QMusicSupport.Models;

namespace QMusicSupport;

internal interface IMusicPlayer
{
    bool Validate(int pid);

    PlayerInfo? GetPlayerInfo();
}
