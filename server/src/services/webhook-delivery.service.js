const prisma = require("../lib/prisma");

// Records a GitHub delivery the first time we see it. Returns the existing row
// if we've seen this deliveryId before, otherwise creates it as RECEIVED and
// returns null. A P2002 (unique) race — two concurrent deliveries of the same
// id — is resolved by re-reading the row that won.
const claimDelivery = async (deliveryId, event) => {
  const existing = await prisma.webhookDelivery.findUnique({
    where: { deliveryId },
  });
  if (existing) {
    return existing;
  }

  try {
    await prisma.webhookDelivery.create({
      data: { deliveryId, event },
    });
    return null;
  } catch (error) {
    if (error.code === "P2002") {
      return prisma.webhookDelivery.findUnique({ where: { deliveryId } });
    }
    throw error;
  }
};

// Marks a delivery finished so any later retry of the same id is skipped.
const markProcessed = async (deliveryId) => {
  return prisma.webhookDelivery.update({
    where: { deliveryId },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
};

module.exports = {
  claimDelivery,
  markProcessed,
};
