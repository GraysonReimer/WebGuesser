export enum LobbyErrorCode { NotFound, LobbyFull, Banned }
export class LobbyErrors {
    public static ErrorMessage(code: LobbyErrorCode): string {
        switch (code) {
            case LobbyErrorCode.NotFound:
                return "The requested lobby could not be found.";
            case LobbyErrorCode.LobbyFull:
                return "The requested lobby is full.";
            case LobbyErrorCode.Banned:
                return "You are not permitted to join this lobby.";
        }
    }
}