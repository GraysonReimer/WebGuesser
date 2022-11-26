import { HttpClient, HttpParams, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectorRef, Inject, Injectable } from '@angular/core';
import { catchError, Observable, of, BehaviorSubject } from 'rxjs';
import * as signalR from "@microsoft/signalr"
import { ActivatedRoute, Router } from '@angular/router';
import { LobbyErrorCode, LobbyErrors } from '../error-handling/lobby-errors';
import { IHttpConnectionOptions } from '@microsoft/signalr';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class LobbyService {
  public lobbyId: string = "";
  public usernameField: string = "";

  public players: BehaviorSubject<Player[]> = new BehaviorSubject<Player[]>([]);
  public clientPlayer: Player = {
    username: "",
    playerId: 0,
    gameId: "",
    isHost: false,
    points: 0,
    icon: -1
  };
  
  private jwtFetched = false;

  //This parameter is set to false in client initialization if they are already authenticated in the lobby.
  private playerIsNew = true;

  private errorMsgTimeout: number = -1;

  public keyWords: string[] = [];

  private readonly playerIconRange = 20;

  private readonly localStorageNameIdentifier = "player_info_username";
  private readonly localStorageIconIdentifier = "player_info_icon";

  private viewChangeDetector?: ChangeDetectorRef;

  constructor(
    private router: Router,
    private http: HttpClient,
    @Inject('BASE_URL') private baseUrl: string,
    private _activatedRoute: ActivatedRoute,
    ) { }


  private hubConnection!: signalR.HubConnection;
    public startHubConnection = () => {
      const options: IHttpConnectionOptions = {
        accessTokenFactory: () => {
          return localStorage.getItem("jwt") as string;
        }
      };

      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(this.baseUrl + "/lobby", options)
        .configureLogging(signalR.LogLevel.Debug)
        .withAutomaticReconnect()
        .build();
      this.hubConnection
        .start()
        .then(() => console.log('Connection started'))
        .catch(err => console.log('Error while starting connection: ' + err));

      this.addLobbyHubListeners();
    }

  public addLobbyHubListeners = () => {
    this.hubConnection.on('playerjoined', newPlayer => {
      this.onPlayerJoinedLobby(newPlayer as Player);
    });

    this.hubConnection.on('usernamechanged', details => {
      let playerToChange = this.getPlayerFromList(details.playerId);
      playerToChange.username = details.newUsername;

      this.updatePlayerData(playerToChange);
    });

    this.hubConnection.on('iconchanged', details => {
      let playerToChange = this.getPlayerFromList(details.playerId);
      playerToChange.icon = details.newIcon;

      this.updatePlayerData(playerToChange);
    });

    this.hubConnection.on('gamestarting', () => {
      this.storeLobbyInfoLocally();

      this.enterStartedGame();
    });

    this.hubConnection.on('addkeyword', keyword => {
      this.addKeyWord(keyword);
    });

    this.hubConnection.on('removekeyword', keyword => {
      this.removeKeyWord(keyword);
    });
  }

  private getPlayerFromList(playerId: number) {
    return this.players.value.filter(player => player.playerId == playerId)[0];   
  }

  public storeLobbyInfoLocally()
  {
    sessionStorage.setItem('game_players', JSON.stringify(this.players.value));
    sessionStorage.setItem('client_id', this.clientPlayer.playerId.toString());
  }

  public enterStartedGame() {
    this.hubConnection.stop();
    this.router.navigate(['game'], { queryParams: { id: this.lobbyId } });
  }

  //For the host. Requests from the server to start the game.
  public requestGameStart() {
    if (!this.canStartGame(true))
      return;

    this.hubConnection.invoke("StartGame")
    .catch(err => console.error(err));
  }
  
  private showClientError(message: string) {
    var errorMessage = document.getElementById("error-txt");
    const errorContainer = document.getElementById('error-msg') as HTMLElement;

    if (!errorMessage) {
      errorMessage = document.createElement("h2"); 
      errorMessage.setAttribute("id", "error-txt");

      errorContainer.appendChild(errorMessage);
    }
    
    errorMessage.innerText = message;

    clearTimeout(this.errorMsgTimeout!);
    this.errorMsgTimeout = window.setTimeout(() => {
      errorContainer.removeChild(errorMessage!);
    }, 4000);
  }

  private showClientRedirectErrors() {
    this._activatedRoute.queryParams.subscribe(params => {
      let errorMessage = LobbyErrors.ErrorMessage(+params['red']);

      if (errorMessage === null || errorMessage === undefined)
        return;

      this.showClientError(errorMessage);
    });
  }

  public onPlayerJoinedLobby(newPlayer: Player) {
    this.addPlayerData(newPlayer);
    this.playAudio("player-join-lobby.mp3");
  }

  private playerIsInLobby(playerId: number): boolean
  {
    let foundId = false;
    this.players.value.forEach(player => {
      if (player.playerId == playerId) 
        foundId = true;
    });

    return foundId;
  }

  //Add one player to the lobby. Updates the list for UI.
  private addPlayerData(newData: Player)
  {
    if (this.playerIsInLobby(newData.playerId))
      return;

    const currentPlayers = this.players.value;
    const updatedPlayers = [...currentPlayers, newData];
    this.players.next(updatedPlayers);
  }

  //Add a list of players to the lobby.. Updates the list for UI.
  private addPlayerListData(newData: Player[])
  {
    let playersToAdd: Player[] = [];
    newData.forEach(player => {
      if (!this.playerIsInLobby(player.playerId))
        playersToAdd.push(player);
    });

    const currentPlayers = this.players.value;
    const updatedPlayers = [...currentPlayers, ...playersToAdd];
    this.players.next(updatedPlayers);

    this.invokeChangeDetector();
  }

  //Sets the data of the player in lobby with matching id. Only local changes.
  private updatePlayerData(newData: Player) {
    const newPlayerList = this.players.value;

    newPlayerList.filter(player => player.playerId == newData.playerId)[0] = newData;

    this.players.next(newPlayerList);
  }

  private redirectHomeWithError(code: LobbyErrorCode)
  {
    this.router.navigate(['/lobby'], { queryParams: { red: code as number } }).then(() => {
      window.location.reload();
    });
  }

  public webSocketConnected(): boolean {
    return this.hubConnection.state == signalR.HubConnectionState.Connected;
  }

  public printHubState() {
    console.log(this.hubConnection.state);
  }

  //Send web socket to all clients to add self to lobby
  syncNewPlayer(request: Player) {
    this.hubConnection.invoke("AddNewPlayerData", request)
    .catch(err => console.error(err));
  }

  //Set up the lobby as a new host
  private initializeLobbyAsNewHost() {
    this.http.get(this.baseUrl + "/api/lobby/create")
    .pipe(
      catchError(error => {
        //If an error occurs, create a new lobby
        console.log(error);
        return of(error);
      })
    )
    .subscribe(result => {
      if (result["success"] != false)
      {
        this.lobbyId = result["lobbyId"];
        this.initializeClientInfo(true);
      }
    });
  }

  public changeUsername($event: any) {
    this.storeUsernameLocally($event.target.value);

    this.hubConnection.invoke('ChangeUsername', $event.target.value);
  }

  public rollNewIcon() {
    var newIcon = this.getRandomIcon(this.getPlayerFromList(this.clientPlayer.playerId).icon);
    this.storeIconLocally(newIcon);

    this.hubConnection.invoke('ChangeIcon', newIcon);
  }

  private storeUsernameLocally(username: string) {
    localStorage.setItem(this.localStorageNameIdentifier, username);
  }

  private storeIconLocally(icon: number) {
    localStorage.setItem(this.localStorageIconIdentifier, String(icon));
  }

  //Set up the lobby as a client
  private initializeLobbyAsClient()
  {
    this.loadKeyWordsIntoGame();
    this.loadPlayers().
    subscribe(result => {
      if (result === null)
      {
        this.showClientError("An unexpected error occured.");
        return;
      }

      this.addPlayerListToGame(result as Player[]);

      if (this.players.value.length > 0)
        this.initializeClientInfo(false);
    });
  }

  private initializeLobbyAsReconnected()
  {
    this.playerIsNew = false;
    this.jwtFetched = true;

    this.loadKeyWordsIntoGame();
    this.loadPlayers().
    subscribe(result => {
      if (result === null)
      {
        this.showClientError("An unexpected error occured.");
        return;
      }

      this.addPlayerListToGame(result as Player[]);
    });
  }

  private addPlayerListToGame(playerList: Player[])
  {
    //If there are no players in the lobby, cancel initialization
    if (playerList.length == 0) {
      this.redirectHomeWithError(LobbyErrorCode.NotFound);
    }
    else if (playerList.length >= 8) {
      this.redirectHomeWithError(LobbyErrorCode.LobbyFull);
    }
    else
    {
      this.addPlayerListData(playerList);
    }
  }

  //Load all keywords into lobby from the database
  private loadKeyWordsIntoGame()
  {
    this.http.get<any>(this.baseUrl + "/api/lobby/keywords", {params: { lobbyId: this.lobbyId }})
    .subscribe(result => {
      if (!result.success)
        return;

      this.keyWords = result.keyWords;
    });
  }

  //Load all players from the database
  private loadPlayers(): Observable<Player[]|null>
  {
    return this.http.get<Player[]>(this.baseUrl + "/api/lobby/players", {params: { lobbyId: this.lobbyId }})
    .pipe(
      catchError(error => {
        //If an error occurs, create a new lobby
        this.redirectHomeWithError(LobbyErrorCode.NotFound);
        return of(error);
      }),
      map((result: any): Player[]|null => {
        if (result.success)
          return result.players;
        
        return null;
      })
    );
  }

  private initializeClientInfo(isHost: boolean)
  {
    this.clientPlayer = {
      username: this.usernameField,
      playerId: 0,
      gameId: this.lobbyId,
      isHost: isHost,
      points: 0,
      icon: this.clientPlayer.icon //Player icon not affected.
    }

    this.http.post(this.baseUrl + "/api/lobby/createclientinfo", this.clientPlayer)
    .pipe(
      catchError(error => {
        //If an error occurs, create a new lobby
        console.log(error);
        return of(error);
      })
    )
    .subscribe(result => {
      if (!result.success)
      {
        this.showClientError("An issue occured while connecting you to our servers.");
        return;
      }

      this.clientPlayer.playerId = result.playerInfo.playerId;
      localStorage.setItem("jwt", result.playerInfo.jwt);

      this.jwtFetched = true;
    });
  }

  sleepUntil = async (f: any, timeoutMs: number) => {
    return new Promise<void>((resolve, reject) => {
      const timeWas = new Date();
      const wait = setInterval(function() {
        if (f()) {
          clearInterval(wait);
          resolve();
        } else if (new Date().getMilliseconds() - timeWas.getMilliseconds() > timeoutMs) {
          clearInterval(wait);
          reject();
        }
      }, 20);
    });
  }

  //If the user token is validated correctly on the server, client info is returned
  fetchAuthenticationInfo(): Observable<Player|null> {
    return this.http.get(this.baseUrl + '/api/lobby/getauthclient', { params: { gameId: this.lobbyId } })
    .pipe(catchError(error => {
      console.log(error);
      return of(error);
    }), map((results: any): Player|null => {
      if (!results.authenticated)
        return null;

      return results.clientInfo as Player;
    }));
  }

  //Load the username from local storage. If it doesn't exist, set a random name.
  private setUsername() {
    this.loadLocalUserInfo();

    //If the username field wasn't set by the local storage, generate a new one
    if (this.usernameField === "")
    {
      this.usernameField = this.generateName();
      this.storeUsernameLocally(this.usernameField);
    }
  }

  private getRandomIcon(exclude = -1): number {
    var randRoll = Math.random();

    if (Math.round(randRoll * (101)) == 100)
      return 255;

    var index = Math.round(randRoll * (this.playerIconRange - 1));

    if (index === exclude)
      return this.getRandomIcon(exclude);

    return index;
  }

  private setIcon() {
    this.loadLocalUserInfo();

    //If the icon was not set, randomize it.
    if (this.clientPlayer.icon === -1)
    {
      this.clientPlayer.icon = this.getRandomIcon();
      this.storeIconLocally(this.clientPlayer.icon);
    }
  }

  startLobby() {
    this.showClientRedirectErrors();

    this.setUsername();
    this.setIcon();

    this._activatedRoute.queryParams
    .subscribe(params => {
      this.lobbyId = params['invite'];
    });

    //If the 'invite' queryparam exists
    if (this.lobbyId === undefined)
    {
      this.initializeLobbyAsNewHost();
    }
    else
    {
      /*The 'invite' queryparam is used for redirecting host and clients from the game back to the lobby.
        Therefore, we have to make a request to the server to check if the user is authenticated and exists in the lobby. */
      this.fetchAuthenticationInfo()
      .subscribe(playerInfo => {
        if (playerInfo === null)
          this.initializeLobbyAsClient();
        else {
          this.clientPlayer = playerInfo;

          this.initializeLobbyAsReconnected();
        }
      });
    }

    //Once the player has recieved the new auth token, from the server, start the hub connection
    this.sleepUntil(() => this.jwtFetched, 10000)
    .then(() => {
      console.log("STARTING HUB CONNECTION!");

      this.startHubConnection();

      var connectionInterval = setTimeout(() => {
        if (this.webSocketConnected()) {
          //Send our client info to sync with other players.
          if (this.playerIsNew)
            this.syncNewPlayer(this.clientPlayer);

          this.hubConnection.invoke("AddConnectionToGame", this.lobbyId);
  
          clearInterval(connectionInterval);
        }
        else
          this.printHubState();
      }, 500);
    })   
  }

  private generateName(): string {
    let randIndex = Math.round(Math.random() * this.nameData.length);
    let nameBase = this.nameData[randIndex] as string;
    return nameBase + Math.floor(Math.random() * 101);
  }

  //Check local storage for player information and apply to session.
  private loadLocalUserInfo() {
    let lsUsername = localStorage.getItem(this.localStorageNameIdentifier);
    let lsIcon = Number(localStorage.getItem(this.localStorageIconIdentifier));

    if (lsUsername !== null)
      this.usernameField = lsUsername;

    if (lsIcon !== null)
      this.clientPlayer.icon = lsIcon;
  }

  public canStartGame(displayErrors: boolean): boolean {
    const dispError = (msg: string) => {
      if (displayErrors)
        this.showClientError(msg);
    }
    
    if (!this.clientPlayer.isHost) {
      dispError("Only the host can start the game.");
      return false;
    }

    if(this.keyWords.length < 4) {
      dispError("You must enter at least four keywords.");
      return false;
    }

    if (this.clientPlayer == null || !this.jwtFetched) {
      dispError("Server Error");
      return false;
    }

    /*if (this.players.value.length < 2) {
      dispError("Two or more players must be in the lobby.");
      return false;
    }*/

    return true;
  }

  public addKeyWord(keyWord: string)
  {
    this.keyWords.push(keyWord);

    if (this.clientPlayer.isHost)
      this.hubConnection.invoke("AddKeyWord", keyWord);
  }

  public removeKeyWord(keyWord: string)
  {
    let index = this.keyWords.indexOf(keyWord);

    if (index == -1)
      return;

    this.keyWords.splice(index, 1);

    if (this.clientPlayer.isHost)
      this.hubConnection.invoke("RemoveKeyWord", keyWord);
  }

  private playAudio(src: string) {
    let audio = new Audio();
    audio.src = "assets/audio/" + src;
    audio.load();
    audio.play();
  }

  private invokeChangeDetector()
  {
    if (this.viewChangeDetector !== undefined)
      this.viewChangeDetector.detectChanges();
  }

  public setChangeDetector(newDect: ChangeDetectorRef)
  {
    this.viewChangeDetector = newDect;
  }

  private nameData: string[] = [
    'Steven',
    'Richard',
    'Howard',
    'Ben',
    'Bob',
    'Joe',
    'Jim',
    'Tim',
    'Larry',
    'Lucas',
    'Micheal',
    'Ron',
    'Adam',
    'Liam',
    'Pablo',
    'Edward',
    'Plumblo',
    'Bill',
    'Jesse',
    'Hunter',
    'Kyle',
    'William',
    'Frank',
    'Jack',
    'Marcus'
  ];
}

export interface Player {
  username: string;
  playerId: number;
  gameId: string;
  isHost: boolean;
  points: number;
  icon: number;
}