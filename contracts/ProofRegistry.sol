// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProofRegistry
/// @notice Stores timestamped file-hash attestations without receiving file data.
contract ProofRegistry {
    struct Proof {
        address submitter;
        uint64 timestamp;
        uint64 blockNumber;
    }

    mapping(bytes32 fileHash => Proof proof) private proofs;

    error EmptyFileHash();
    error ProofAlreadyExists(bytes32 fileHash);

    event ProofRegistered(
        bytes32 indexed fileHash,
        address indexed submitter,
        uint64 timestamp
    );

    function registerProof(bytes32 fileHash) external {
        if (fileHash == bytes32(0)) revert EmptyFileHash();
        if (proofs[fileHash].submitter != address(0)) {
            revert ProofAlreadyExists(fileHash);
        }

        uint64 registeredAt = uint64(block.timestamp);
        proofs[fileHash] = Proof({
            submitter: msg.sender,
            timestamp: registeredAt,
            blockNumber: uint64(block.number)
        });

        emit ProofRegistered(fileHash, msg.sender, registeredAt);
    }

    function getProof(bytes32 fileHash)
        external
        view
        returns (address submitter, uint64 timestamp, uint64 blockNumber)
    {
        Proof memory proof = proofs[fileHash];
        return (proof.submitter, proof.timestamp, proof.blockNumber);
    }

    function proofExists(bytes32 fileHash) external view returns (bool) {
        return proofs[fileHash].submitter != address(0);
    }
}
