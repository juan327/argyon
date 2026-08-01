import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "src/environments/environment";
import { Note } from "../entities/note";
import { Temporal } from 'temporal-polyfill';

@Injectable({ providedIn: 'root' })

export class GenericService {

    public addMinutes(date: Date, minutes: number): Date {
        const result = new Date(date);
        result.setMinutes(result.getMinutes() + minutes);
        return result;
    }

    public addHours(date: Date, hours: number): Date {
        const result = new Date(date);
        result.setHours(result.getHours() + hours);
        return result;
    }


    public convertUtcToTimezone(date: Date, timezone: string): Date {
        const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());

        const zoned = instant.toZonedDateTimeISO(timezone);
        return new Date(zoned.toPlainDateTime().toString());
    }

    public formatBytes(bytes: number): string {
        if (bytes <= 0) return '0b';
        const units = ['b', 'kb', 'mb', 'gb', 'tb'];
        const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        const value = bytes / Math.pow(1024, exponent);
        const formatted = exponent === 0 ? value.toString() : Number(value.toFixed(2)).toString();
        return `${formatted} ${units[exponent]}`;
    }

}
