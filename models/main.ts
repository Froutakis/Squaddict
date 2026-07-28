export class User { 
    id: string;
    name: string;

    isOnline: boolean;

    constructor(id: string, name: string, isOnline: boolean){
        this.id = id;
        this.name = name;
        this.isOnline = isOnline;
    }
}

export class Group {
    id: string;
    name: string;
    members: Array<User>;
    messages: Array<Message>;

    constructor(id: string, name: string, members: Array<User> = [], messages: Array<Message> = []){
        this.id = id;
        this.name = name;
        this.members = members;
        this.messages = messages;
    }

    addMember(u: User): void {
        this.members.push(u);
        
        console.log(`User ${u.name} added!`);
    }

    removeMember(u: User): void {
        this.members = this.members.filter(member => member.id != u.id);

        console.log(`User ${u.name} removed!`);
    }

    addMessage(m: Message): void {
        this.messages.push(m);
        console.log(`💬 ${m.sender.name}: ${m.content}`);    
    }
    showConversation(): void {
        console.log(`--- Συνομιλία: ${this.name} ---`);
        for (const m of this.messages) {
            console.log(`${m.sender.name}: ${m.content}`);
        }
    }
}

export class Message{
    id: string;
    content: string;
    sender: User;
    date: Date;

    constructor(id: string, content: string, sender: User, date: Date = new Date()){
        this.id = id;
        this.content = content;
        this.sender = sender;
        this.date = date;
    }

}

