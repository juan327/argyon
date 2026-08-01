export class DTOGet {
    id: string;
    isFolder: boolean;
    isFavorite: boolean;
    hasAttachments: boolean;
    name: string;
    nameIv: string;
    data: string | null;
    dataIv: string | null;
    tags: string | null;
    tagsIv: string | null;
    description: string | null;
    descriptionIv: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;

    constructor(id: string, isFolder: boolean, isFavorite: boolean, hasAttachments: boolean, name: string, nameIv: string, data: string | null, dataIv: string | null, tags: string | null, tagsIv: string | null, description: string | null, descriptionIv: string | null, parentId: string | null, createdAt: Date, updatedAt: Date) {
        this.id = id;
        this.isFolder = isFolder;
        this.isFavorite = isFavorite;
        this.hasAttachments = hasAttachments;
        this.name = name;
        this.nameIv = nameIv;
        this.data = data;
        this.dataIv = dataIv;
        this.tags = tags;
        this.tagsIv = tagsIv;
        this.description = description;
        this.descriptionIv = descriptionIv;
        this.parentId = parentId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}

export class DTOImportResult {
    importedCount: number;
    failedTempIds: string[];

    constructor(importedCount: number, failedTempIds: string[]) {
        this.importedCount = importedCount;
        this.failedTempIds = failedTempIds;
    }
}
