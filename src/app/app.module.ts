import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { NotfoundComponent } from './notfound/notfound.component';
import { PlayerTagComponent } from './player-tag/player-tag.component';
import { LobbyService } from './services/lobby.service';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; 
import { AuthInterceptor } from './http-interceptors/jwt-interceptor';
import { GameService } from './services/game.service';
import { GameComponent } from './game/game.component';
import { RoundOptionComponent } from './round-option/round-option.component';
import { CountDownComponent } from './count-down/count-down.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ScrollingBackdropComponent } from './scrolling-backdrop/scrolling-backdrop.component';
import { LoadingIconComponent } from './loading-icon/loading-icon.component';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    NotfoundComponent,
    PlayerTagComponent,
    GameComponent,
    RoundOptionComponent,
    CountDownComponent,
    ScrollingBackdropComponent,
    LoadingIconComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule
  ],
  providers: [
    LobbyService,
    GameService,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: 'BASE_URL', useFactory: getBaseUrl },
    {provide: LocationStrategy, useClass: HashLocationStrategy}
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }

export function getBaseUrl() {
  return "https://api.webguesser.com";
}