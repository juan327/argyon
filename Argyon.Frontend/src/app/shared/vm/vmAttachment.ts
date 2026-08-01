export class VMCreate {
    noteId: string = '';
    name: string = '';
    nameIv: string = '';
    contentIv: string = '';
    file: File | null = null; // picked up by HttpService.PostForm's `instanceof File` branch
}

export class VMDelete {
    noteId: string = '';
    attachmentId: string = '';
}
