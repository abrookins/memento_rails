class Map < ActiveRecord::Base
  belongs_to :user
  has_many :memories
  has_many :feeds
end
