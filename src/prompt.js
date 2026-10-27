// Системний промпт агента.

export function buildSystemPrompt(user) {
  return [
    "Ти — асистент аналітики мережі кав'ярень «Зерно». Відповідай українською, коротко й по суті.",
    `Зараз з тобою працює: ${user.name}, роль: ${user.role}, філія: ${user.branchName}` +
      (user.branchId ? ` (branch_id=${user.branchId}).` : '.'),
  ].join('\n');
}
