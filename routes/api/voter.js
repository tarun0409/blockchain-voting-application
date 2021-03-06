const express = require('express');
const router = express.Router();
ObjectId = require('mongodb').ObjectID;
Election = require('../../models/Election.model');
Admin = require('../../models/Admin.model');
Candidate = require('../../models/Candidate.model');
Voter = require('../../models/Voter.model');
BlockchainApp = require('../../utils/blockchain');

router.get('/', (req,res) => {
    if(!req.query.electionId)
    {
        return res.status(400).json({msg:"Query field not included : electionId", input:req.query});
    }
    var electionQuery = {};
    electionQuery._id = ObjectId(req.query.electionId);
    Election.find(electionQuery).then((elections) => {
        if(elections.length === 0)
        {
            return res.status(400).json({msg:"Invalid election ID", input:req.query});
        }
        voterQuery = {};
        voterQuery.Election_ID = ObjectId(req.query.electionId);
        Voter.find(voterQuery).then((votersFetched) => {
            if(votersFetched.length === 0)
            {
                return res.status(204).json({voters:[]});
            }
            res.json({voters:votersFetched});
        }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Problem with fetching voters from database"});
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Problem with fetching elections from database"});
    });
});

router.get('/:id', (req,res) => {
    if(!req.query.electionId)
    {
        return res.status(400).json({msg:"Query field not included : electionId", input:req.query});
    }
    var electionQuery = {};
    electionQuery._id = ObjectId(req.query.electionId);
    Election.find(electionQuery).then((elections) => {
        if(elections.length === 0)
        {
            return res.status(400).json({msg:"Invalid election ID", input:req.query});
        }
        voterQuery = {};
        voterQuery._id = ObjectId(req.params.id);
        Voter.find(voterQuery).then((votersFetched) => {
            if(votersFetched.length === 0)
            {
                return res.status(204).json({voters:[]});
            }
            res.json({voters:votersFetched});
        }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Problem with fetching voters from database"});
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Problem with fetching elections from database"});
    });
});

router.post('/register', (req,res) => {
    
    if(!req.body.voters)
    {
        return res.status(400).json({msg:"Invalid format.", input:req.body});
    }
    if(!req.query.from)
    {
        return res.status(400).json({msg:"Fields to be included : from", query:req.query});
    }
    if(!req.query.electionId)
    {
        return res.status(400).json({msg:"Fields to be included : electionId", query:req.query});
    }
    var electionQuery = {};
    electionQuery._id = ObjectId(req.query.electionId);
    Election.find(electionQuery).then((elections) => {
        if(elections.length <= 0)
        {
            return res.status(400).json({msg:"Invalid election ID", query:req.query});
        }
        BlockchainApp.initBlockchainServer(elections[0].Port);
        BlockchainApp.web3.eth.getAccounts((err,accounts) => {
            if(err)
            {
                console.log(err);
                return res.status(500).json({msg:"Problem occurred while trying to get accounts from contract"});
            }
            voters = Array();
            voterPubKeys = Array();
            for(i=0; i<req.body.voters.length; i+=1)
            {
                if(!req.body.voters[i].Name)
                {
                    return res.status(400).json({msg:"Field not included : Name", input:req.body});
                }
                if(!req.body.voters[i].Public_Key)
                {
                    return res.status(400).json({msg:"Field not included : Public Key", input:req.body});
                }
                if(!accounts.includes(req.body.voters[i].Public_Key))
                {
                    return res.status(400).json({msg:"Invalid Public key given"});
                }
                voterPubKeys.push(req.body.voters[i].Public_Key);
                var voter = {};
                voter.Name = req.body.voters[i].Name;
                voter.Public_Key = req.body.voters[i].Public_Key;
                voter.Election_ID = req.query.electionId;
                voter.Voted = false;
                if(req.body.voters[i].Voting_Location)
                {
                    voter.Voting_Location = req.body.voters[i].Voting_Location;
                }
                if(req.body.voters[i].Comments)
                {
                    voter.Comments = req.body.voters[i].Comments;
                }
                var voterObj = new Voter(voter);
                voters.push(voterObj);
            }
            var adminQuery = {};
            adminQuery._id = ObjectId(req.query.from);
            Admin.find(adminQuery).then((admins) => {
                if(admins.length <= 0)
                {
                    return res.status(400).json({msg:"Invalid from Admin ID", query:req.query});
                }
                var fromObj = {};
                fromObj.from = admins[0].Public_Key;
                var electionContract = BlockchainApp.getSmartContract();
                electionContract.deployed().then((instance) => {
                    instance.registerVoter(voterPubKeys[0],fromObj).then(() => {
                        Voter.create(voters).then((createdVoters) => {
                            var successResponseObj = {};
                            successResponseObj.msg = "Voter(s) inserted successfully";
                            successResponseObj.data = createdVoters;
                            return res.status(201).json(successResponseObj);
                        }).catch((err) => {
                            console.log(err);
                            return res.status(500).json({msg:"Problem occurred while registering voter in database"});
                        });
                    }).catch((err) => {
                        console.log(err);
                        return res.status(500).json({msg:"Problem occurred while registering voter in blockchain"});
                    });
                }).catch((err) => {
                    console.log(err);
                    return res.status(500).json({msg:"Problem occurred while trying to deploy contract"});
                });
            }).catch((err) => {
                console.log(err);
                return res.status(500).json({msg:"Problem occurred while fetching admins from database"});
            });
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Problem occurred while fetching elections from database"});
    });
});

router.post('/:id/vote/:candidateId',(req, res) => {
    if(!req.query.electionId)
    {
        return res.status(400).json({msg:"Query fields to be included: electionId"});
    }
    if(!req.body.nonce)
    {
        return res.status(400).json({msg:"Fields to be included: nonce"});
    }
    electionQuery = {};
    electionQuery._id = ObjectId(req.query.electionId);
    Election.find(electionQuery).then((elections) => {
        if(elections.length <= 0)
        {
            return res.status(400).json({msg:"Invalid electionId"});
        }
        var voterQuery = {};
        voterQuery._id = ObjectId(req.params.id);
        Voter.find(voterQuery).then((voters) => {
            if(voters.length <= 0)
            {
                return res.status(400).json({msg:"Invalid voter ID"});
            }
            if(voters[0].Voted)
            {
                return res.status(400).json({msg:"Voter has already voted."});
            }
            var fromObj = {};
            fromObj.from = voters[0].Public_Key;
            var candidateQuery = {};
            candidateQuery._id = ObjectId(req.params.candidateId);
            Candidate.find(candidateQuery).then((candidates) => {
                if(candidates.length <= 0)
                {
                    return res.status(400).json({msg:"Invalid candidate ID"});
                }
                var candidatePubKey = candidates[0].Public_Key;
                BlockchainApp.initBlockchainServer(elections[0].Port);
                var electionContract = BlockchainApp.getSmartContract();
                electionContract.deployed().then((instance) => {
                    var nonceHash = BlockchainApp.web3.utils.soliditySha3(req.body.nonce);
                    var voteHash = BlockchainApp.web3.utils.soliditySha3(candidatePubKey, nonceHash);
                    instance.vote(voteHash, fromObj).then(() => {
                        var voteUpdate = {};
                        voteUpdate.Voted = true;
                        Voter.updateOne(voterQuery,voteUpdate, (err) => {
                            if(err)
                            {
                                return res.status(500).json({msg:"Some problem occurred while updating admin(s)"});
                            }
                            return res.status(200).json({msg:"Voting status updated successfully"});
                        });      
                    }).catch((err) => {
                        console.log(err);
                        return res.status(500).json({msg:"Some problem occurred while trying to vote in blockchain"});
                    });
                }).catch((err) => {
                        console.log(err);
                        return res.status(500).json({msg:"Some problem occurred while deploying smart contract"});
                });
            }).catch((err) => {
                    console.log(err);
                    return res.status(500).json({msg:"Some problem occurred while fetching candidates from database"});
            });
        }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Some problem occurred while fetching voters from database"});
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Some problem occurred while fetching elections from database"});
    });
});

router.post('/:id/nonce/reveal', (req, res) => {
    if(!req.query.electionId)
    {
        return res.status(400).json({msg:"Query fields to be included: electionId"});
    }
    if(!req.body.nonce)
    {
        return res.status(400).json({msg:"Fields to be included: nonce"});
    }
    electionQuery = {};
    electionQuery._id = ObjectId(req.query.electionId);
    Election.find(electionQuery).then((elections) => {
        if(elections.length <= 0)
        {
            return res.status(400).json({msg:"Invalid electionId"});
        }
        var voterQuery = {};
        voterQuery._id = ObjectId(req.params.id);
        Voter.find(voterQuery).then((voters) => {
            if(voters.length <= 0)
            {
                return res.status(400).json({msg:"Invalid voter ID"});
            }
            var nonces = elections[0].Nonces;
            BlockchainApp.initBlockchainServer(elections[0].Port);
            nonces.push(BlockchainApp.web3.utils.soliditySha3(req.body.nonce));
            var electionObj = {};
            electionObj.Nonces = nonces;
            Election.updateOne(electionQuery,electionObj, (err) => {
                if(err)
                {
                    return res.status(500).json({msg:"Some problem occurred while updating nonce"});
                }
                return res.status(200).json({msg:"Nonce updated successfully"});
            });
        }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Some problem occurred while fetching voters from database"});
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Some problem occurred while fetching elections from database"});
    });
});

router.put('/:id', (req,res) => {
    if(!req.query.electionId)
    {
        return res.status(400).json({msg:"Fields to be included: electionId"});
    }
    electionQuery = {};
    electionQuery._id = ObjectId(req.query.electionId);
    Election.find(electionQuery).then((elections) => {
        if(elections.length <= 0)
        {
            return res.status(400).json({msg:"Invalid electionId"});
        }
        queryObj = {};
        queryObj._id = ObjectId(req.params.id);
        if(req.body.Public_Key)
        {
            return res.status(400).json({msg:"Public Key of Voter cannot be changed. You may try to delete the voter and insert again"});
        }
        if(req.body.Election_ID)
        {
            return res.status(400).json({msg:"Election ID of voter cannot be changed"});
        }
        if("Voted" in req.body)
        {
            return res.status(400).json({msg:"Cannot update Voted field with this API."});
        }
        Voter.updateOne(queryObj,req.body, (err) => {
            if(err)
            {
                return res.status(500).json({msg:"Some problem occurred while updating admin(s)"});
            }
            return res.status(200).json({msg:"Voter updated successfully", data:req.body});
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Some problem occurred while fetching elections from database"}); 
    });
});

router.delete('/:id', (req,res) => {
    if(!req.query.electionId)
    {
        return res.status(400).json({msg:"Query field not included : electionId", input:req.query});
    }
    if(!req.query.from)
    {
        return res.status(400).json({msg:"Query field not included : from", input:req.query});
    }
    electionQuery = {};
    electionQuery._id = ObjectId(req.query.electionId);
    Election.find(electionQuery).then((elections) => {
        if(elections.length === 0)
        {
            return res.status(400).json({msg:"Invalid election ID", input:req.query});
        }
        var adminQuery = {};
        adminQuery._id = ObjectId(req.query.from);
        Admin.find(adminQuery).then((admins) => {
            if(admins.length === 0)
            {
                return res.status(400).json({msg:"Invalid from admin ID", input:req.query});
            }
            fromObj = {};
            fromObj.from = admins[0].Public_Key;
            var voterQuery = {};
            voterQuery._id = ObjectId(req.params.id);
            Voter.find(voterQuery).then((voters) => {
                if(voters.length === 0)
                {
                    return res.status(400).json({msg:"Invalid voter ID", input:req.query});
                }
                var delVoterPubKey = voters[0].Public_Key;
                var delVoterObj = {};
                delVoterObj._id = ObjectId(req.params.id);
                BlockchainApp.initBlockchainServer(elections[0].Port);
                var electionContract = BlockchainApp.getSmartContract();
                electionContract.deployed().then((instance) => {
                    instance.removeVoter(delVoterPubKey, fromObj).then(() => {
                        Voter.deleteOne(delVoterObj, (err) => {
                            if(err)
                            {
                                console.log(err);
                                return res.status(500).json({msg:"Some problem occurred while removing voter from database"});
                            }
                            return res.status(200).json({msg:"Voter deleted successfully"});
                        });
                    }).catch((err) => {
                        console.log(err);
                        return res.status(500).json({msg:"Some problem occurred while removing voter from blockchain"});
                    });
                }).catch((err) => {
                    console.log(err);
                    return res.status(500).json({msg:"Some problem occurred while deploying smart contract"});
                });

            }).catch((err) => {
                console.log(err);
                return res.status(500).json({msg:"Some problem occurred while fetching voters from database"});
            });
        }).catch((err) => {
            console.log(err);
            return res.status(500).json({msg:"Some problem occurred while fetching admins from database"});
        });
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({msg:"Some problem occurred while fetching elections from database"});
    });
});

module.exports = router;