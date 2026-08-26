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

/**
 * Το δημόσιο προφίλ μιας Παρέας — ό,τι βλέπει ΚΑΙ ένας μη-μέλος.
 *
 * Το `handle` είναι η ταυτότητα: μοναδικό, πεζά λατινικά, δεν αλλάζει.
 * Το `name` είναι το εμφανιζόμενο όνομα: ελεύθερο, αλλάζει όποτε θέλουν.
 *
 * Τα μέλη και τα μηνύματα ΔΕΝ ζουν εδώ μέσα: τα φέρνει το serviceGroup όταν
 * και όποτε χρειάζονται, και μόνο για όποιον έχει δικαίωμα να τα δει.
 */
export type Group = {
    id: string;
    handle: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    memberCount: number;
};

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

