import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LobbyService } from '../services/lobby.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  public joinGameId = '';

  joinLobby() {
    if (this.joinGameId == this.lobbyService.lobbyId)
      return;
    
    this.router.navigate(['/lobby'], { queryParams: { invite: this.joinGameId } }).then(() => {
      location.reload();
    });
  }

  copyInviteLink()
  {
    if (this.lobbyService.lobbyId != null)
      navigator.clipboard.writeText(this.lobbyService.lobbyId);
  }

  //If enter is pressed, submit the username changes
  onUsernameInput($event: any) {
    if($event.keyCode == 13){
      $event.target.blur();
    }
  }

  constructor(private router: Router, public lobbyService: LobbyService, private changeDetector: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.lobbyService.setChangeDetector(this.changeDetector);

    this.lobbyService.startLobby();
  }

  private keyWordIsValid(keyWord: string): boolean {
    return keyWord.length !== 0 && 
      keyWord.trim() !== '' &&
      !this.lobbyService.keyWords.includes(keyWord);
  }

  public addKeyWord($event: any) {
    if (!this.lobbyService.clientPlayer.isHost || $event.keyCode !== 13)
      return;
    
    let inputValue = $event.target.value as string;
    
    if (!this.keyWordIsValid(inputValue))
      return;

    this.lobbyService.addKeyWord(inputValue);

    let keyWordList = document.getElementById("key-word-list");

    keyWordList!.scrollTop = keyWordList!.scrollHeight;

    $event.target.value = "";
  }

  public removeKeyWord($event: any) {
    if (!this.lobbyService.clientPlayer.isHost)
      return;

    let valueToRemove = $event.target.innerText as string;

    this.lobbyService.removeKeyWord(valueToRemove);
  }
}
