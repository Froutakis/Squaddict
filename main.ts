export class User { 
    id: string;
    name: string;
    username: string;
    password: string;
    isOnline: boolean;


    constructor(id: string, name: string, username: string, password: string, isOnline: boolean){
        this.id = id;
        this.name = name;
        this.username = username;
        this.password = password;
        this.isOnline = isOnline;
    }
}

export class Group {
    id: string;
    name: string;
    members: Array<User>;
    
    constructor(id: string, name: string, members: Array<User> = [] ){
        this.id = id;
        this.name = name;
        this.members = members;
    }

}

