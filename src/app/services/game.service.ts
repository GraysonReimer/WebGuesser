import { Inject, Injectable, ComponentFactoryResolver, Injector, ApplicationRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, Observable, of, BehaviorSubject, map, mergeMap } from 'rxjs';
import * as signalR from "@microsoft/signalr"
import { Player } from './lobby.service';
import { RoundOption } from '../round-option/round-option.component';
import { LobbyErrorCode } from '../error-handling/lobby-errors';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private gameId: string = "";

  public gameInfo!: GameInfo;

  public players: BehaviorSubject<Player[]> = new BehaviorSubject<Player[]>([]);
  public clientPlayer!: Player;

  public roundOptions: RoundOption[] = [];

  public canSubmitAnswer = false;
  public roundResults?: RoundResults;
  public submittedAnswer = -1;
  public canStartNewRound = true;

  public roundStartTime: Date = new Date();

  private countDownSeconds = 3;
  private roundEndSeconds = 10;

  private musicAudio?: HTMLAudioElement;

  private roundEndCountdown = -1;

  public imageSource = "Fetching a new image. This may take a second.";

  private roundImagePath = "assets/images/round-images/";

  public serverDelays: string[] = [];

  private countDownEvent?: (c: number) => void;

  private imageAlterationInterval = -1;

  public setCountDownEvent(fn: (c: number) => void) {
    this.countDownEvent = fn;
  }

  private fetchImageWaitMsg = "Fetching image for next round. This may take some time.";

  constructor(
    private router: Router,
    @Inject('BASE_URL') private baseUrl: string,
    private activatedRoute: ActivatedRoute,
    private http: HttpClient,
    ) {
   }

   public hubConnection!: signalR.HubConnection;
    public startConnection = () => {
      var options: signalR.IHttpConnectionOptions = {
        accessTokenFactory: () => {
          return localStorage.getItem("jwt") as string;
        }
      };

      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(this.baseUrl + "/game", options)
        .configureLogging(signalR.LogLevel.Debug)
        .withAutomaticReconnect()
        .build();
      this.hubConnection
        .start()
        .then(() => console.log('Connection started'))
        .catch(err => console.log('Error while starting connection: ' + err));

        this.addLobbyHubListeners();
  }

  private resetImageSource()
  {
    this.imageSource = "assets/images/default-image-source.png";
  }

  private getRoundImage()
  {
    this.imageSource = "https://web-guesser.s3.ca-central-1.amazonaws.com/altered-round-images/" + this.gameId + ".jpg" + "?" + (new Date()).getTime();
  }

  private getRoundImageUnaltered()
  {
    this.imageSource = "https://web-guesser.s3.ca-central-1.amazonaws.com/round-images/" + this.gameId + ".jpg" + "?" + (new Date()).getTime();
  }

  private addLobbyHubListeners() {
    this.hubConnection.on('newround', info => {
      this.getRoundImage();

      if (this.clientPlayer.isHost)
        this.imageAlterationInterval = window.setInterval(() => { this.loadNextImageAlteration() }, 1000);


      this.roundStartTime = new Date();

      this.roundOptions = [];

      info.roundOptions.forEach((roundOption: { id: number, word: string }) => {
        this.roundOptions.push({ id: roundOption.id, word: roundOption.word });
      });

      this.submittedAnswer = -1;
      this.canSubmitAnswer = true;

      //If you are the host, wait 10 seconds and then end the round for all clients from the server.
      this.roundEndCountdown = window.setTimeout(() => {
        this.hubConnection.invoke('EndRound');
      }, this.roundEndSeconds * 1000);

      this.toggleMusic(true);
    });

    this.hubConnection.on('startroundcountdown', (countDownSeconds: number) => {

      //Announced delays between the host and countdown are hidden.
      this.removeServerDelay(this.fetchImageWaitMsg);

      this.countDownEvent!(countDownSeconds);

      //Set results to undefined to reset round option button states.
      this.roundResults = undefined;

      //If you are the host, wait 3 seconds and then start the round for all clients from the server.
      if (this.clientPlayer.isHost) {
        setTimeout(() => {
          this.hubConnection.invoke('StartNewRound');
        }, countDownSeconds * 1000);
      }
    });

    this.hubConnection.on('EndRound', (results: RoundResults) => {
      this.onRecieveRoundResults(results);

      //Set the image to the unaltered image.
      this.getRoundImage();
    });
    
    this.hubConnection.on('EndGame', (results: RoundResults) => {
      this.onRecieveRoundResults(results);
      this.hubConnection.stop();
      this.router.navigate(['/lobby'], { queryParams: { invite: this.gameId } });
    });

    this.hubConnection.on('ServerWait', (message: string) => {
      this.addServerDelay(message);
    });

    this.hubConnection.on('NextAlteration', () => {
      this.getRoundImage();
    })

    this.hubConnection.on("ImageUnaltered", () => {
      this.getRoundImageUnaltered();
    });

    this.hubConnection.on("HostQuit", () => {
      this.exitToLobby(LobbyErrorCode.HostQuit);
    });

    this.hubConnection.on("RemoveUser", (userId: number) => {
      this.removePlayer(userId);
    });
  }

  private loadNextImageAlteration() {
    this.http.get(this.baseUrl + "/api/game/nextalteration")
    .pipe(catchError(error => {
      console.log(error);
      return of(error);
    })).subscribe(() => {
      this.hubConnection.invoke("NextImageAlteration");
    });
  }

  //Tell the server to change the displayed round image to the uncompressed one.
  private setImageToUnaltered() {
    this.http.get(this.baseUrl + "/api/game/settounaltered")
    .pipe(catchError(error => {
      console.log(error);
      return of(error);
    }))
    .subscribe(() => {
      this.hubConnection.invoke("ImageUnaltered");
      this.canStartNewRound = true;
    });
  }

  private onRecieveRoundResults(results: RoundResults)
  {
    this.setImageToUnaltered();

      //If we are the host, remove the countdown that ends the round automatically after 10 seconds if not all players have answered
      if (this.clientPlayer.isHost)
        clearTimeout(this.roundEndCountdown);

      //Stop making requests to the server for more image alterations.
      if (this.clientPlayer.isHost)
        window.clearInterval(this.imageAlterationInterval);

      this.roundResults = results;

      //Update all the players points
      this.roundResults.pointsSummary.forEach(ps => {
        this.players.value.filter(x => x.playerId === ps.playerId)[0].points = ps.points;
      });

      if (this.submittedAnswer === this.roundResults!.correctAnswerId)
        this.onCorrectAnswer();
      else
        this.onIncorrectAnswer();
        
      this.toggleMusic(false);
  }

  private loadRoundImage(): Observable<boolean> {
    return this.http.get(this.baseUrl + "/api/game/loadroundimage", { params: { gameId: this.gameId } })
    .pipe(catchError(error => {
      console.log(error);
      return of(false);
    }), (map(() => {
      return true;
    })));
  }

  private toggleMusic(toggle: boolean) {
    if (toggle) {
      if (this.musicAudio === undefined)
      {
        this.musicAudio = new Audio();
        this.musicAudio.src = "assets/audio/round-music.mp3";
        this.musicAudio.load();
      }

      this.musicAudio.play();
    }
    else {
      if (this.musicAudio !== undefined)
      {
      this.musicAudio!.pause();
      this.musicAudio!.currentTime = 0;
      }
    }
  }

  private exitToLobby(errorCode: LobbyErrorCode | null = null)
  {
      this.router.navigate(['/lobby'], { queryParams: errorCode !== null ? { red: Number(errorCode) } : {} }).then(() => {
        window.location.reload();
      });
  }

  private loadGameInfoLocally() {
    let localPlayersValue = sessionStorage.getItem('game_players');
    let localClientIdValue = sessionStorage.getItem('client_id');

    if (localPlayersValue === null || localClientIdValue === null)
      this.exitToLobby();

    this.players.next(JSON.parse(localPlayersValue as string));

    this.clientPlayer = this.players.value.filter(x => x.playerId === +(localClientIdValue as string))[0];

    if (this.clientPlayer === null)
      this.exitToLobby();
  }

  private removePlayer(playerId: number)
  {
    const currentPlayers = this.players.value;

    var indexOfPlayer = currentPlayers.findIndex(x => x.playerId == playerId);
    if (indexOfPlayer === -1)
      return;

    currentPlayers.splice(indexOfPlayer, 1);

    this.players.next(currentPlayers);
  }

  public joinGame()
  {
    this.resetImageSource();

    this.playAudio("game-begin.mp3");

    this.activatedRoute.queryParams
    .subscribe(params => {
      this.gameId = params["id"];
    });

    if (this.gameId === undefined)
      this.exitToLobby();

    var params = new HttpParams().set("id", this.gameId);
    this.http.get(this.baseUrl + '/api/game/join', { params: params })
    .pipe(
      catchError(error => {

        //Client is likely not authenticated and should not access this page.
        this.exitToLobby();

        return of(error);
      })
    )
    .subscribe(result => {

      //Client is not allowed in game
      if (!result.success)
        this.exitToLobby();

      this.loadGameInfoLocally();

      this.startConnection();
      var connectionInterval = setTimeout(() => {
        if (this.webSocketConnected()) {          
          //Start new round...
          if (this.clientPlayer.isHost)
            this.startNewRound();

          clearInterval(connectionInterval);
        }
        else
          this.printHubState();
      }, 500);
    });
  }

  public printHubState() {
    console.log(this.hubConnection.state);
  }

  public webSocketConnected(): boolean {
    return this.hubConnection.state == signalR.HubConnectionState.Connected;
  }

  public startNewRound() {
    if (!this.canStartNewRound)
      return;
    
    this.canStartNewRound = false;

    this.fetchGameInfo()
    .subscribe(info => {
      this.gameInfo = info;
    });

    this.hubConnection.invoke("InformClientsServerWait", this.fetchImageWaitMsg);

    //Tell the server to load the image for the round from SerpApi
    this.loadRoundImage().subscribe(result => {
      if (result)
        this.hubConnection.invoke("StartRoundCountDown", this.countDownSeconds);
      else
        this.exitToLobby();
    });
  }

  private fetchGameInfo(): Observable<GameInfo> {
    console.log("Fetching game info...");

    let params = new HttpParams().set("gameId", this.gameId);

    return this.http.get(this.baseUrl + "/api/game/info", { params: params })
    .pipe(catchError(error => {
      console.log(error);
      return of(error);
    }), map(x => {
      return x as GameInfo;
    }));
  }

  public sendAnswer = (option: RoundOption) => {    
    if (!this.canSubmitAnswer)
      return;

    this.http.post(this.baseUrl + "/api/game/answer", option)
    .pipe(catchError(error => {
      console.log(error);
      return of(error);
    }))
    .subscribe(result => {
      if (!result.success)
        return;

      this.submittedAnswer = option.id;
      this.hubConnection.invoke("PlayerAnswerSubmitted");
      this.canSubmitAnswer = false;
    });
  }

  private playAudio(src: string) {
    let audio = new Audio();
    audio.src = "assets/audio/" + src;
    audio.load();
    audio.play();
  }

  private onCorrectAnswer() {
    this.playAudio("correct-answer.mp3");
  }

  private onIncorrectAnswer() {
    this.playAudio("incorrect-answer.mp3");
  }

  //Add a message to user to indicate a delay on the server.
  private addServerDelay(message: string) {
    this.serverDelays.push(message);
  }

  //Remove a message about a server delay from the server.
  private removeServerDelay(message: string) {
    var index = this.serverDelays.indexOf(message);

    if (index !== -1)
      this.serverDelays.splice(index, 1);
  }
}

export interface GameInfo {
  roundIndex: number;
  totalRounds: number;
}

export interface RoundResults {
  correctAnswerId: number,
  pointsSummary: PlayerPoints[]
}

export interface PlayerPoints {
  playerId: number,
  points: number
}