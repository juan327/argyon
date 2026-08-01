
export interface Note
{
    id: string;
    isFolder: boolean;
    isFavorite: boolean;
    hasAttachments: boolean;
    name: string;
    data: Note_Category[];
    tags: string;
    description: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    notes: Note[];
}

export interface Folder {
    id: string;
    name: string;
    tags: string;
    description: string | null;
    folders: Folder[];
}

export class Note_Category {
    id: string = crypto.randomUUID();
    name: string = '';
    description: string | null = null;
    data: Note_Data[] = [];
}

export class Note_Data {
    Type: Note_Data_Type = Note_Data_Type.Text;
    label: string = '';
    placeholder: string = '';
    value: string = '';
    // Only relevant when Type === Note_Data_Type.Date; which date parts to show/edit.
    dateDay?: boolean;
    dateMonth?: boolean;
    dateYear?: boolean;
    dateHour?: boolean;
}

export enum Note_Data_Type {
    Text = 1,
    Password = 2,
    TextArea = 3,
    Date = 4,
    CardNumber = 10,
}

export type NoteTemplate = 'password' | 'page' | 'card';

export const NOTE_DATE_TYPES: Note_Data_Type[] = [Note_Data_Type.Date];

export interface Note_Date_Type_Config {
    view: 'date' | 'month' | 'year';
    showTime: boolean;
    timeOnly: boolean;
    dateFormat: string;
}

// Day implies month+year and month implies year (enforced by the field editor UI), so the only
// combinations reachable in practice are: year alone, month+year, day+month+year, any of those
// with hour added, and hour alone (no day/month/year selected at all).
export function getDateFieldConfig(day: boolean, month: boolean, year: boolean, hour: boolean, dayFormat: string, monthYearFormat: string): Note_Date_Type_Config {
    if (!day && !month && !year) {
        return { view: 'year', dateFormat: '', showTime: false, timeOnly: true };
    }
    return {
        view: day ? 'date' : month ? 'month' : 'year',
        dateFormat: day ? dayFormat : month ? monthYearFormat : 'yy',
        showTime: hour,
        timeOnly: false,
    };
}

export const NOTE_MASK_TYPE_CONFIG: Partial<Record<Note_Data_Type, string>> = {
    [Note_Data_Type.CardNumber]: '9999 9999 9999 9999',
};

export const NOTE_MASK_TYPES: Note_Data_Type[] = Object.keys(NOTE_MASK_TYPE_CONFIG).map(Number);
