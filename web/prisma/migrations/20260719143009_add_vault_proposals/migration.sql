-- CreateTable
CREATE TABLE "VaultProposal" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "changes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultProposalApproval" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultProposalApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VaultProposalApproval_proposalId_pubkey_key" ON "VaultProposalApproval"("proposalId", "pubkey");

-- AddForeignKey
ALTER TABLE "VaultProposal" ADD CONSTRAINT "VaultProposal_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultProposalApproval" ADD CONSTRAINT "VaultProposalApproval_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "VaultProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
