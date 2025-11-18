export function generateChatRoomId(userId1: string, userId2: string): string {
  // Sort user IDs to ensure consistent room ID regardless of order
  const sortedIds = [userId1, userId2].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
}

