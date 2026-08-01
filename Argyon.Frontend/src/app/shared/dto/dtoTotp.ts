export class DTOSetup {
    secret: string = '';
    uri: string = '';
}

export class DTOEnable {
    recoveryCodes: string[] = [];
}

export class DTOStatus {
    isEnabled: boolean = false;
}
