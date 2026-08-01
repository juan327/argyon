export class VMPost
{
    parentNoteId: string | null = null;
    name: string = '';
    nameIv: string = '';
    data: string = '';
    dataIv: string | null = null;
    tags: string | null = null;
    tagsIv: string | null = null;
    description: string | null = null;
    descriptionIv: string | null = null;
    isFavorite: boolean = false;
}

export class VMPut extends VMPost
{
    noteId: string = '';
}

export class VMDelete
{
    noteId: string = '';
    authHash: string = '';
}

export class VMSetFavorite
{
    noteId: string = '';
    isFavorite: boolean = false;
}

export class VMImportItem
{
    tempId: string = '';
    parentTempId: string | null = null;
    isFolder: boolean = false;
    name: string = '';
    nameIv: string = '';
    data: string | null = null;
    dataIv: string | null = null;
    tags: string | null = null;
    tagsIv: string | null = null;
    description: string | null = null;
    descriptionIv: string | null = null;
}

export class VMImport
{
    items: VMImportItem[] = [];
    targetParentId: string | null = null;
}