// Хто зараз працює з агентом. У реальній системі це приходить із сесії після входу,
// а не з тексту питання. Саме ця різниця — головна тема майстер-класу.

export const USERS = {
  olena: {
    login: 'olena',
    name: 'Олена Коваль',
    role: 'manager',
    branchId: 1,
    branchName: 'Київ',
  },
  petro: {
    login: 'petro',
    name: 'Петро Гнатюк',
    role: 'manager',
    branchId: 2,
    branchName: 'Львів',
  },
  director: {
    login: 'director',
    name: 'Ірина Мельник',
    role: 'director',
    branchId: null,
    branchName: 'усі філії',
  },
};

export function getUser(login = 'olena') {
  const user = USERS[login];
  if (!user) {
    throw new Error(`Невідомий користувач "${login}". Доступні: ${Object.keys(USERS).join(', ')}`);
  }
  return user;
}
