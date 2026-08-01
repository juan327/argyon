export class DTOGet {
    id: string;
    name: string;
    nameIv: string;
    contentIv: string;
    sizeBytes: number;
    createdAt: Date;

    constructor(id: string, name: string, nameIv: string, contentIv: string, sizeBytes: number, createdAt: Date) {
        this.id = id;
        this.name = name;
        this.nameIv = nameIv;
        this.contentIv = contentIv;
        this.sizeBytes = sizeBytes;
        this.createdAt = createdAt;
    }
}
