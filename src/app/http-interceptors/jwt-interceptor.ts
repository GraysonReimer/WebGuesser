import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    intercept(req: HttpRequest<any>,
              next: HttpHandler): Observable<HttpEvent<any>> {

        const idToken = localStorage.getItem("jwt");

        if (idToken) {
            const cloned = req.clone({
                setHeaders: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                withCredentials: true,
            });
            return next.handle(cloned);
        }
        else {
            return next.handle(req);
        }
    }
}