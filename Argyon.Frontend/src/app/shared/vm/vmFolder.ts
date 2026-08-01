export class VMPost
{
    parentNoteId: string | null = null;
    name: string = '';
    nameIv: string = '';
    description: string | null = null;
    descriptionIv: string | null = null;
    tags: string | null = null;
    tagsIv: string | null = null;
    isFavorite: boolean = false;
}

export class VMPut extends VMPost
{
    noteId: string = '';
}