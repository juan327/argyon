import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { DTOGeneric, DTOUser } from "src/app/shared/dto";
import { HttpService } from "src/app/shared/services/http.service";
import { VMFolder, VMNote } from "src/app/shared/vm";
import { TranslateService } from "@ngx-translate/core";

export interface PasswordScore {
    score: number;
    label: string;
    breakdown: Record<string, number>;
}


@Injectable({ providedIn: 'any' })
export class GeneratePasswordService {

    private httpService = inject(HttpService);
    private readonly _translate = inject(TranslateService);

    public getButtonCharacters() {
        return [
            { id: 1, label: 'a-z', pattern: 'abcdefghijklmnopqrstuvwxyz', active: false },
            { id: 2, label: 'A-Z', pattern: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', active: false },
            { id: 3, label: '0-9', pattern: '0123456789', active: false },
            { id: 4, label: '#$%&@^`~', pattern: '#$%&@^`~', active: false },
            { id: 5, label: this._translate.instant('generatePassword.extendedAscii'), pattern: 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿµ®¶', active: false },
            { id: 6, label: '.,:;', pattern: '.,:;', active: false },
            { id: 7, label: '"\'', pattern: '"\'', active: false },
            { id: 8, label: '\\/|_-', pattern: '\\/|_-', active: false },
            { id: 9, label: '<>*+!?=', pattern: '<>*+!?=', active: false },
            { id: 10, label: '{[()]}', pattern: '{[()]}', active: false },
        ]
    }

    public getPattern(buttonCharacters: Array<{ id: number, label: string, pattern: string, active: boolean }>): string {
        const activeButtons = buttonCharacters.filter(button => button.active);
        const pattern = activeButtons.map(button => button.pattern).join('');
        return pattern;
    }

    /* private generatePassword(
        length: number,
        pattern: string,
        prioritizeSpecialChars: boolean = false
    ): string {

        let uppercase = '';
        let lowercase = '';
        let numbers = '';
        let specials = '';

        if (pattern.includes('A-Z')) {
            uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        }

        if (pattern.includes('a-z')) {
            lowercase = 'abcdefghijklmnopqrstuvwxyz';
        }

        if (pattern.includes('0-9')) {
            numbers = '0123456789';
        }

        // Extract special characters from the pattern
        specials = pattern.replace(/[A-Za-z0-9\-\[\]]/g, '');

        const allChars = uppercase + lowercase + numbers + specials;

        if (!allChars.length) {
            throw new Error('No hay caracteres válidos para generar la contraseña');
        }

        const result: string[] = [];

        // Prioritize specials only if enabled
        if (
            prioritizeSpecialChars &&
            specials.length > 0
        ) {
            const minSpecials = Math.max(
                1,
                Math.floor(length * 0.25)
            );

            for (let i = 0; i < minSpecials; i++) {
                result.push(
                    this.getSecureRandomChar(specials)
                );
            }
        }

        // Fill the remaining length
        while (result.length < length) {
            result.push(
                this.getSecureRandomChar(allChars)
            );
        }

        // Shuffle to maintain randomness
        this.secureShuffle(result);

        return result.join('');
    } */

    public generatePassword(
        length: number,
        pattern: string,
        prioritizeSpecialChars: boolean = false
    ): string {
        if (!pattern.length) {
            return '';
        }

        const result: string[] = [];
        const specials = pattern.replace(/[A-Za-z0-9\-\[\]]/g, '');

        // Prioritize specials only if enabled
        if (
            prioritizeSpecialChars &&
            specials.length > 0
        ) {
            const minSpecials = Math.max(
                1,
                Math.floor(length * 0.25)
            );

            for (let i = 0; i < minSpecials; i++) {
                result.push(
                    this.getSecureRandomChar(specials)
                );
            }
        }

        // Fill the remaining length
        while (result.length < length) {
            result.push(
                this.getSecureRandomChar(pattern)
            );
        }

        // Shuffle to maintain randomness
        this.secureShuffle(result);

        return result.join('');
    }

    private getSecureRandomChar(chars: string): string {
        const randomArray = new Uint32Array(1);
        crypto.getRandomValues(randomArray);

        const index = randomArray[0] % chars.length;

        return chars[index];
    }

    private secureShuffle(array: string[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const randomArray = new Uint32Array(1);
            crypto.getRandomValues(randomArray);

            const j = randomArray[0] % (i + 1);

            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    calculatePasswordScore(password: string): PasswordScore {
        if (!password) return { score: 0, label: this._translate.instant('generatePassword.score.noPassword'), breakdown: {} };

        const breakdown: Record<string, number> = {};
        let score = 0;
        const len = password.length;

        // --- Special characters: up to 40 pts ---
        // The maximum is reached with ≥ 4 specials OR ratio ≥ 40%
        const specialMatches = (password.match(/[^a-zA-Z0-9]/g) || []).length;
        const hasSpecial = specialMatches > 0;
        let specialScore = 0;
        if (hasSpecial) {
            const byCount = Math.min(1, specialMatches / 4);       // 4+ specials = 100%
            const byRatio = Math.min(1, (specialMatches / len) / 0.4); // ratio 40%+ = 100%
            specialScore = Math.round(Math.max(byCount, byRatio) * 40);
        }
        breakdown['specials'] = specialScore;
        score += specialScore;

        // --- Length: up to 20 pts ---
        // The maximum is reached with ≥ 16 characters
        const lengthScore = Math.round(Math.min(1, (len - 4) / 12) * 20);
        breakdown['length'] = Math.max(0, lengthScore);
        score += Math.max(0, lengthScore);

        // --- Uppercase: up to 15 pts ---
        // The maximum is reached with ≥ 3 uppercase letters
        const upperCount = (password.match(/[A-Z]/g) || []).length;
        const upperScore = Math.round(Math.min(1, upperCount / 3) * 15);
        breakdown['uppers'] = upperScore;
        score += upperScore;

        // --- Lowercase: 10 pts (binary) ---
        const lowerScore = /[a-z]/.test(password) ? 10 : 0;
        breakdown['lowers'] = lowerScore;
        score += lowerScore;

        // --- Numbers: up to 10 pts ---
        // The maximum is reached with ≥ 3 numbers
        const numCount = (password.match(/[0-9]/g) || []).length;
        const numScore = Math.round(Math.min(1, numCount / 3) * 10);
        breakdown['numbers'] = numScore;
        score += numScore;

        // --- No repetition: 5 pts (binary) ---
        const uniqueRatio = new Set(password).size / len;
        const noRepeatScore = uniqueRatio >= 0.5 ? 5 : 0;
        breakdown['noRepeat'] = noRepeatScore;
        score += noRepeatScore;

        // --- Hard cap: no specials → maximum 49 ---
        if (!hasSpecial) score = Math.min(score, 49);

        score = Math.max(0, Math.min(100, score));

        const label = score === 100 ? this._translate.instant('generatePassword.score.perfect')
            : score >= 80 ? this._translate.instant('generatePassword.score.veryStrong')
                : score >= 60 ? this._translate.instant('generatePassword.score.strong')
                    : score >= 40 ? this._translate.instant('generatePassword.score.moderate')
                        : score >= 20 ? this._translate.instant('generatePassword.score.weak')
                            : this._translate.instant('generatePassword.score.veryWeak');

        return { score, label, breakdown };
    }
}
